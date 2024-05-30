"use client"

import React, {
  useRef,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react"
import Map, { MapRef } from "react-map-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import maplibregl from "maplibre-gl"
import DrawBboxControl from "./draw-bbox-control"
import { bbox } from "@turf/turf"
import { ScenarioControl } from "./scenario-control"
import { useStore } from "../../app/lib/store"
import { difference } from "lodash-es"
import { DrawControlPane } from "./draw-control-pane"
import { ColorLegend } from "./color-legend"

type MapViewProps = {
  children?: ReactNode
  center: number[]
  zoom: number
  id: string
  studySlug: string
}

export type MapFeature = { id: string; shading: number; isSelected: boolean }

const getDbIntersectingFeatures = async ({
  coordinates,
  studySlug,
  scenarioSlug,
  metricsField,
}) => {
  console.log("getting intersection")
  const linestring = coordinates
    ? encodeURI(coordinates.map(pair => pair.join(" ")).join(","))
    : null
  const searchResponse = await fetch(
    `${global.window?.location.origin}/api/search/${studySlug}/${scenarioSlug}/${metricsField}?coordinates=${linestring}`
  )
  return await searchResponse.json()
}

const MapView = ({ id, center, zoom, children, studySlug }: MapViewProps) => {
  const [map, setMap] = useState<MapRef>()
  const mapContainer = useRef(null)
  const setMapRef = (m: MapRef) => setMap(m)
  const { setAoi, setMapInteraction } = useStore()
  const selectedStudy = useStore(state => state.selectedStudy)
  const { aoi, mapInteraction, isMapStagedForClearing, selectedTheme } =
    selectedStudy
  const [selectedFeaturesById, setSelectedFeaturesById] = useState<{
    [id: string]: MapFeature
  } | null>(null)
  const {
    setHoveredFeature,
    setTotalSelectedFeatures,
    setSummaryAvg,
    setSummaryDescription,
    setSummaryMax,
    setSummaryTotal,
    setSummaryUnit,
    setMapStagedForClearing,
  } = useStore()
  const selectedScenario = selectedTheme.selectedScenario
  const category = selectedScenario?.selectedCategory?.value
  const usage = selectedScenario?.selectedUsage?.value
  const source = selectedScenario?.selectedSource?.value
  const metricsField = `${category}.${usage}.${source}`

  const updateFeatureState = async ({
    coordinates,
    studySlug,
    scenarioSlug,
    metricsField,
  }) => {
    // only run this for draw interactions
    const search = await getDbIntersectingFeatures({
      coordinates,
      studySlug,
      scenarioSlug,
      metricsField,
    })
    const summaryTotal = search.search[0]?.data_total ?? 0
    const summaryUnit = search.search[0]?.data_unit ?? ""
    const summaryAvg = search.search[0]?.data_avg ?? 0
    const summaryDescription = search.search[0]?.data_description ?? ""
    const dbSearchFeatures = search.search[0].feature_objects

    setSummaryDescription(summaryDescription)
    setSummaryMax(parseInt(search.search[0].data_max))
    setTotalSelectedFeatures(dbSearchFeatures.length)
    setSummaryAvg(summaryAvg)
    setSummaryTotal(summaryTotal)
    setSummaryUnit(summaryUnit)

    // add isSelected property to dbSearchFeatures
    const augmentedDbFeatures = dbSearchFeatures.reduce((acc, feature) => {
      acc[feature.id] = {
        ...feature,
        isSelected: true,
      }
      return acc
    }, {})

    // update empty features
    if (!selectedFeaturesById) {
      setSelectedFeaturesById(augmentedDbFeatures)
    }

    if (mapInteraction === "selection") {
      if (isMapStagedForClearing) {
        setSelectedFeaturesById(state => {
          if (!state) return null
          Object.values(state).forEach(feature => {
            state[feature.id].isSelected = false
          })
          return state
        })
      }
      updateSelectionFeatures(dbSearchFeatures, search.search[0].data_max)
      // Remember to clear state when map clears
    } else {
      updateDrawFeatures(dbSearchFeatures, search.search[0].data_max)
      setSelectedFeaturesById(state => {
        if (!state) return null
        Object.values(state).forEach(feature => {
          state[feature.id].isSelected = false
        })
        return { ...state, ...augmentedDbFeatures }
      })
    }
    setTotalSelectedFeatures(dbSearchFeatures.length)
  }

  useEffect(() => {
    if (![map, category, usage, source].every(Boolean)) return
    updateFeatureState({
      coordinates: aoi.feature ? aoi.feature.geometry.coordinates[0] : null,
      studySlug,
      metricsField,
      scenarioSlug: selectedScenario?.slug,
    })
  }, [
    aoi.feature,
    map,
    metricsField,
    selectedScenario?.slug,
    mapInteraction,
    isMapStagedForClearing,
  ])

  const updateSelectionFeatures = (dbSearchFeatures, summaryMax) => {
    if (!selectedFeaturesById) return

    const selectedFeatures = selectedFeaturesById
      ? Object.values(selectedFeaturesById)
      : []

    if (isMapStagedForClearing) {
      selectedFeatures.forEach(feature => {
        // Update the paint properties of specific features by ID
        map!.setFeatureState(
          {
            source: "building-footprints",
            sourceLayer: "default",
            id: feature.id,
          },
          {
            selected: false,
            relative_shading_percentage: (feature.shading / summaryMax) * 100,
          }
        )
      })
      setMapStagedForClearing(false)
      return
    }

    dbSearchFeatures.forEach(feature => {
      // Update the paint properties of specific features by ID
      map!.setFeatureState(
        {
          source: "building-footprints",
          sourceLayer: "default",
          id: feature.id,
        },
        {
          selected: selectedFeaturesById[feature.id].isSelected,
          relative_shading_percentage: (feature.shading / summaryMax) * 100,
        }
      )
    })
  }

  const updateDrawFeatures = (dbSearchFeatures, summaryMax) => {
    const selectedFeatures = selectedFeaturesById
      ? Object.values(selectedFeaturesById)
      : []
    // remove Ids that are no longer in new array of ids
    const toRemove = difference(selectedFeatures, dbSearchFeatures)

    toRemove.forEach(featureData => {
      // Update the paint properties of specific features by ID
      map!.setFeatureState(
        {
          source: "building-footprints",
          sourceLayer: "default",
          id: featureData.id,
        },
        { selected: undefined, relative_shading_percentage: undefined }
      )
    })

    // add Ids that are in new selection but not in previous yet
    const toAdd = difference(dbSearchFeatures, selectedFeatures)

    toAdd.forEach(feature => {
      // Update the paint properties of specific features by ID
      map!.setFeatureState(
        {
          source: "building-footprints",
          sourceLayer: "default",
          id: feature.id,
        },
        {
          selected: true,
          relative_shading_percentage: (feature.shading / summaryMax) * 100,
        }
      )
    })
  }

  // map event handlers
  const handleDrawComplete = (feature: GeoJSON.Feature) => {
    setMapInteraction(null)
    setAoi({
      bbox: bbox(feature.geometry),
      feature,
    })
  }

  const drawUpdate = (feature: GeoJSON.Feature) => {
    setAoi({
      bbox: bbox(feature.geometry),
      feature,
    })
  }
  const drawSelectionChange = () => {
    console.log("draw selection fired")
  }

  // hover feature handler
  useEffect(() => {
    if (!map || mapInteraction !== "selection") return

    let hoveredPolygonId: string | null = null

    const hoverLayerName = "buildings-layer"

    const handleMouseMove = (e: any) => {
      if (e.features && e.features.length > 0) {
        map.getCanvas().style.cursor = "pointer"
        const newHoveredPolygonId = e.features[0].id ?? null
        if (newHoveredPolygonId !== hoveredPolygonId) {
          if (hoveredPolygonId !== null) {
            map.setFeatureState(
              {
                source: "building-footprints",
                sourceLayer: "default",
                id: hoveredPolygonId,
              },
              { hover: false }
            )
          }

          hoveredPolygonId = newHoveredPolygonId ?? null

          setHoveredFeature({
            id: hoveredPolygonId,
            location: e.lngLat,
            value: e.features[0].properties.shading,
            unit: e.features[0].properties.unit,
          })

          map.setFeatureState(
            {
              source: "building-footprints",
              sourceLayer: "default",
              id: hoveredPolygonId as any,
            },
            { hover: true }
          )
        }
      }
    }

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ""
      if (hoveredPolygonId !== null) {
        map.setFeatureState(
          {
            source: "building-footprints",
            sourceLayer: "default",
            id: hoveredPolygonId,
          },
          { hover: false }
        )
        hoveredPolygonId = null
        setHoveredFeature({
          id: null,
          location: null,
          value: null,
          unit: null,
        })
      }
    }

    map.on("mousemove", hoverLayerName, handleMouseMove)
    map.on("mouseleave", hoverLayerName, handleMouseLeave)

    return () => {
      map.off("mousemove", hoverLayerName, handleMouseMove)
      map.off("mouseleave", hoverLayerName, handleMouseLeave)
    }
  }, [map, setHoveredFeature, mapInteraction])

  const singleSelectionHandler = useCallback(
    e => {
      if (!map) return
      if (e.features && e.features.length > 0 && selectedFeaturesById) {
        const clickedFeature = e.features[0]
        const clickedFeatureId = clickedFeature.id
        const selectedFeature = selectedFeaturesById[clickedFeatureId]

        // Update map feature
        map.setFeatureState(
          {
            source: "building-footprints",
            sourceLayer: "default",
            id: clickedFeatureId,
          },
          {
            selected: clickedFeature.state.selected ? undefined : true,
            relative_shading_percentage: clickedFeature.state.selected
              ? undefined
              : clickedFeature.properties.shading_percentage,
          }
        )

        // update state features
        setSelectedFeaturesById(state => {
          if (!state) {
            return null
          } else {
            return {
              ...state,
              [clickedFeature.id]: {
                ...state[clickedFeature.id],
                isSelected: selectedFeature.isSelected ? false : true,
              },
            }
          }
        })
      }
    },
    [selectedFeaturesById, map, mapInteraction]
  )

  useEffect(() => {
    if (!map || mapInteraction !== "selection") return

    map.on("click", "buildings-layer", singleSelectionHandler)

    return () => {
      map.off("click", "buildings-layer", singleSelectionHandler)
    }
  }, [map, singleSelectionHandler, mapInteraction])

  return (
    <div ref={mapContainer} className="h-full w-full">
      <Map
        ref={setMapRef}
        style={{ width: "100%", height: "100%" }}
        initialViewState={{
          latitude: center[1],
          longitude: center[0],
          zoom,
        }}
        mapLib={maplibregl}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      >
        <ScenarioControl />
        <DrawControlPane />
        <ColorLegend />
        <DrawBboxControl
          {...{
            map: map!,
            isEnabled: mapInteraction === "drawing",
            handleDrawComplete,
            aoi,
            drawSelectionChange,
            drawUpdate,
          }}
        />
        {map &&
          children &&
          React.Children.map(children, child =>
            React.cloneElement(child as JSX.Element, {})
          )}
      </Map>
    </div>
  )
}

export default MapView

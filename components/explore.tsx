"use client"

import { SidePane } from "./side-pane"
import Map from "./map/map"
import { Source, Layer, Popup } from "react-map-gl"
import { useStore } from "../app/lib/store"
import { largeNumberDisplay } from "../lib/utils"
interface Props {
  params: { slug: string }
  metaData: Studies.Study
}

const Explore: React.FC<Props> = ({ params, metaData }) => {
  const layerType =
    metaData?.scale?.toLowerCase() === "building" ? "fill-extrusion" : "line"

  const { selectedStudy, show3d, hoveredFeature } = useStore()
  const { selectedTheme, mapInteraction } = selectedStudy

  const selectedScenario = selectedTheme.selectedScenario
  const category = selectedScenario?.selectedCategory?.value
  const usage = selectedScenario?.selectedUsage?.value || "ALL"
  const source = selectedScenario?.selectedSource?.value || "ALL"

  const metricsField = `${category}.${usage}.${source}`

  return (
    <>
      <SidePane
        {...{
          imgSrc: metaData.image_src,
          studyId: params.slug,
        }}
      />
      <div className="row-span-1 col-span-2 md:col-span-1">
        <Map
          {...{
            id: "explore-map",
            layerType,
            studySlug: params.slug,
            bbox: metaData.bbox,
          }}
        >
          <Source
            id="building-footprints"
            promoteId={"key"}
            type="vector"
            tiles={[
              `${global.window?.location.origin}/api/tiles/${params.slug}/${selectedScenario?.slug}/${metricsField}/{z}/{x}/{y}`,
            ]}
            minzoom={2}
            maxzoom={14}
          >
            <Layer
              id="buildings-layer"
              beforeId={
                metaData?.scale?.toLowerCase() === "building"
                  ? "housenumber"
                  : "road_path"
              }
              type="fill-extrusion"
              source={"buildings"}
              source-layer="default"
              paint={{
                "fill-extrusion-height": [
                  "case",
                  [
                    "boolean",
                    selectedStudy.scale === "Building" && show3d,
                    true,
                  ],
                  ["*", ["to-number", ["get", "floors"]], 5], // multiply by 5m for each floor as a typical estimate
                  0,
                ],
                "fill-extrusion-color": [
                  "case",
                  ["boolean", ["feature-state", "hover"], false],
                  "#DAEBFF", // hovered features
                  ["boolean", ["feature-state", "selected"], false],
                  [
                    "interpolate-hcl",
                    ["linear"],
                    ["feature-state", "relative_shading_percentage"],
                    0,
                    "#fab482",
                    100,
                    "#720a0a",
                  ],
                  "#dadada", // deselected features
                ],
                "fill-extrusion-opacity": 0.9,
              }}
            />
            {mapInteraction === "selection" && (
              <Layer
                id="buildings-outline-layer"
                beforeId={
                  metaData?.scale?.toLowerCase() === "building"
                    ? "housenumber"
                    : "road_path"
                }
                minzoom={metaData?.scale?.toLowerCase() === "building" ? 14 : 0}
                type="line"
                source={"buildings"}
                source-layer="default"
                paint={{
                  "line-color": "#fab482",
                  "line-width": 1,
                  "line-opacity":
                    metaData?.scale?.toLowerCase() === "building" ? 0.5 : 0.2,
                }}
              />
            )}
          </Source>
          {hoveredFeature?.id ? (
            <Popup
              longitude={hoveredFeature?.location?.lng ?? 0}
              latitude={hoveredFeature?.location?.lat ?? 0}
              anchor="bottom"
              closeButton={false}
              style={{ padding: 0 }}
            >
              <div
                className="font-medium text-sm"
                style={{ fontFamily: "Helvetica Neue" }}
              >
                <div>{hoveredFeature.id}</div>
                <div>
                  <span className="font-medium mr-1 ">
                    {largeNumberDisplay(hoveredFeature.value ?? 0, 0)}
                  </span>
                  <span className="font-light text-xs">
                    {hoveredFeature.unit}
                  </span>
                </div>
              </div>
            </Popup>
          ) : (
            <></>
          )}
        </Map>
      </div>
    </>
  )
}

export default Explore

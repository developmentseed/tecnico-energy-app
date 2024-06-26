import { notFound } from "next/navigation"
import { useStore } from "@/app/lib/store"
import { getMetricsMetadata, getStudy } from "@/app/lib/data"
import Explore from "@/components/explore"
import StoreInitialize from "@/components/store-initialize"
import { Header } from "@/components/header"
import { getUniqueMetricsCombinations } from "../../lib/utils"

export default async function ExplorePage({
  params,
}: {
  params: { slug: string }
}) {
  const study = await getStudy(params.slug)
  if (!study) notFound()

  const metricsMetadata = await getMetricsMetadata(study.slug)
  const studyMetadata = getUniqueMetricsCombinations(metricsMetadata)
  const initialCategory = Object.values(metricsMetadata)[0]?.category ?? null
  const initialUsage = Object.values(metricsMetadata)[0]?.usage ?? null
  const initialScenario = {
    slug: "baseline",
    description: "The baseline values where no scenario has been applied yet.",
    name: "Baseline",
    selectedCategory: initialCategory
      ? { value: initialCategory, label: initialCategory }
      : null,
    selectedSource: null,
    selectedUsage: initialUsage
      ? { value: initialUsage, label: initialUsage }
      : null,
  }

  const selectedStudy = {
    ...study,
    // store themes and scenarios as dictionaries for easier lookup
    themes: study?.themes.reduce((acc, theme) => {
      acc[theme.slug] = {
        ...theme,
        selectedScenario: initialScenario,
        scenarios: {
          ...theme?.scenarios.reduce((acc, scenario) => {
            if (scenario.scenario?.slug) {
              acc[scenario.scenario?.slug] = {
                slug: scenario.scenario_slug,
                name: scenario.scenario?.name,
                selectedCategory: {
                  value: initialCategory,
                  label: initialCategory,
                },
                selectedSource: null,
                selectedUsage: null,
              }
            }
            return acc
          }, {}),
          baseline: initialScenario,
        },
      }
      return acc
    }, {}),
    metadata: studyMetadata,
    selectedTheme: {
      ...study.themes[0],
      selectedScenario: initialScenario,
      scenarios: {
        ...study.themes[0]?.scenarios.reduce((acc, scenario) => {
          if (scenario.scenario?.slug) {
            acc[scenario.scenario?.slug] = {
              slug: scenario.scenario_slug,
              name: scenario.scenario?.name,
              description: scenario.scenario?.description,
              selectedCategory: {
                value: initialCategory,
                label: initialCategory,
              },
              selectedSource: null,
              selectedUsage: null,
            }
          }
          return acc
        }, {}),
        baseline: initialScenario,
      },
    },
    selectedThemeId: study.themes[0]?.slug,
    summary: {
      totalSelectedFeatures: 0,
      summaryUnit: "",
      summaryDescription: "",
      summaryTotal: 0,
      summaryAvg: 0,
      summaryMax: 0,
    },
    mapInteraction: null,
    isMapStagedForClearing: false,
    aoi: { feature: undefined, bbox: [] },
  }
  const stateObject = {
    selectedStudy,
  }

  useStore.setState(stateObject)

  return (
    <>
      <StoreInitialize stateObject={stateObject} />
      <div className="grid grid-cols-1 grid-rows-[auto,1fr,1fr] md:grid-cols-[420px,1fr] md:grid-rows-[auto,1fr] h-screen w-full overflow-x-hidden">
        <div className="row-span-1 col-span-2 relative border-b border-gray-200">
          <Header />
        </div>
        <Explore params={params} metaData={selectedStudy} />
      </div>
    </>
  )
}

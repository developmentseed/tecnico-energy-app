import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { NextRequest } from "next/server"

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { study_slug, metrics_field, scenario_slug } = params
  const coordinates = req?.nextUrl?.searchParams.get("coordinates")!
  // get all features if we have no aoi
  // only return the aggregated values from metrics with LIMIT 1
  if (coordinates == "null") {
    const search = await prisma.$queryRaw`
       WITH AllGeometries AS (
    SELECT
        g.key AS id,
        CAST(m.data -> ${metrics_field} ->> 'value' AS NUMERIC) AS data_value,
        CAST(m.data -> ${metrics_field} ->> 'description' AS VARCHAR) AS data_description,
        m.data -> ${metrics_field} ->> 'units' AS data_unit
    FROM 
        geometries g
    JOIN  
        scenario_metrics m ON g.key = m.geometry_key
    WHERE
        (g.study_slug = ${study_slug} AND m.scenario_slug IS NULL AND ${scenario_slug} = 'baseline') OR 
        (g.study_slug = ${study_slug} AND m.scenario_slug IS NOT NULL AND m.scenario_slug = ${scenario_slug}))
      SELECT 
          SUM(COALESCE(CAST(data_value AS NUMERIC), 0)) AS data_total,
          AVG(COALESCE(data_value, 0)) AS data_avg,
          MAX(COALESCE(data_value, 0)) AS data_max,
          data_unit,
          data_description,
          json_agg(json_build_object('id', id, 'shading', data_value)) AS feature_objects
      FROM 
          AllGeometries
      GROUP BY data_unit, data_description
      ORDER BY data_total desc
      LIMIT 1
    `
    return Response.json({ search })
  }

  const lineStringCoords = Prisma.raw(decodeURI(coordinates))

  const search = await prisma.$queryRaw`
    WITH IntersectedGeometries AS (
    SELECT
        g.key AS id,
        CAST(m.data -> ${metrics_field} ->> 'value' AS NUMERIC) AS data_value,
        CAST(m.data -> ${metrics_field} ->> 'description' AS VARCHAR) AS data_description,
        m.data -> ${metrics_field} ->> 'units' AS data_unit
    FROM 
        geometries g
    JOIN  
        scenario_metrics m ON g.key = m.geometry_key
    WHERE
        ST_Intersects(
            ST_Transform(geom, 3857),
            ST_Transform(
                ST_Polygon(
                    'LINESTRING(${lineStringCoords})'::geometry, 
                    4326
                ), 
                3857
            )
        )
        AND
          ((g.study_slug = ${study_slug} AND m.scenario_slug IS NULL AND ${scenario_slug} = 'baseline') OR 
          (g.study_slug = ${study_slug} AND m.scenario_slug IS NOT NULL AND m.scenario_slug = ${scenario_slug}))
      )
      SELECT 
          SUM(COALESCE(CAST(data_value AS NUMERIC), 0)) AS data_total,
          AVG(COALESCE(data_value, 0)) AS data_avg,
          MAX(COALESCE(data_value, 0)) AS data_max,
          data_unit,
          data_description,
          json_agg(json_build_object('id', id, 'shading', data_value)) AS feature_objects
      FROM 
          IntersectedGeometries
      GROUP BY data_unit, data_description
      ORDER BY data_total desc
      LIMIT 1
  `

  return Response.json({ search })
}

interface Params {
  study_slug: string
  scenario_slug: string
  coordinates: string
  metrics_field: string
}

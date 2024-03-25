import { ObjectId } from 'mongodb';
import { z } from 'zod';
export const ObjectIDSchema = z.union([z.string(), z.instanceof(ObjectId)]).optional();

const GeoJSONTypes = z.union([
	z.literal('Point'),
	z.literal('LineString'),
	z.literal('Polygon'),
	z.literal('MultiPoint'),
	z.literal('MultiLineString'),
	z.literal('MultiPolygon')
]);

export const CoordinatesSchema = z.object({
	type: GeoJSONTypes,
	coordinates: z.number().array().length(2)
});

export const BoundingBoxSchema = z.object({
    type: GeoJSONTypes,
    coordinates: z.array(z.number().array().length(2)).length(4)
})

export const OSMSchema = z.object({
    place_id: z.number(),
    licence: z.string(),
    osm_type: z.literal('node').or(z.literal('way')).or(z.literal('relation')),
    osm_id: z.number(),
    lat: z.string(),
    lon: z.string(),
    class: z.string(),
    type: z.string(),
    place_rank: z.number(),
    importance: z.number(),
    addresstype: z.string(),
    name: z.string(),
    display_name: z.string(),
    boundingbox: z.array(z.string()),
  });

export const LocationData = z.object({
    psgc: z.string().min(10).max(10),
    name: z.string(),
    longname: z.string(),
    geographicLevel: z.string(),
    oldNames: z.string(),
    cityClass: z.string(),
    incomeClassification: z.string(),
    isRural: z.boolean(),
    population: z.number(),
    status: z.number(),
    coords: CoordinatesSchema.optional(),
    boundingBox: BoundingBoxSchema.optional(),
    osmresult: OSMSchema.optional(),
})
export type Location = z.infer<typeof LocationData>

export const QuerySchema = LocationData.pick({
    psgc: true,
    longname: true
})
export type Query = z.infer<typeof QuerySchema>

export const UpdateData = LocationData.pick({
    coords: true,
    boundingBox: true,
    osmresult: true,
})
export type Update = z.infer<typeof UpdateData>
export enum Collection {
    Location = 'location'
}

export enum Status {
    Queued,
    AddressParsed,
    Requested,
    Completed
}
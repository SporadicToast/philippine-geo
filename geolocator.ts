import { ok } from "assert";
import { ServerApiVersion } from "mongodb";
import { MongoClient, ObjectId } from "mongodb";
import { z } from 'zod';

const uri = 'mongodb://localhost:27017';

const client = new MongoClient(uri, {
    serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true
	}
})

interface PipelineType extends Array<Record<string, any>> {};


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
	_id: ObjectIDSchema,
	type: GeoJSONTypes,
	coordinates: z.number().array().length(2)
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const BoundingBoxSchema = z.object({
	type: GeoJSONTypes,
	coordinates: z.array(z.number().array().length(2)).length(4)
});

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export enum Collection {
	EARTHQUAKE = 'earthquake',
	STATION = 'station',
	EVAC = 'evac',
	INFO = 'info',
	SESSIONS = 'sessions',
	PENDINGS = 'pendings',
	USERS = 'users',
	MEDIA = 'posts',
	COMMENTS = 'comments',
	LOCATION = 'locations'
}


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
	boundingbox: z.array(z.string())
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
	coord: CoordinatesSchema.optional(),
	boundingBox: BoundingBoxSchema.optional(),
	osmresult: OSMSchema.optional()
});

export type Location = z.infer<typeof LocationData>;

export const EarthquakeEventSchema = z.object({
	_id: ObjectIDSchema,
	title: z.string().optional(),
	time: z.string().datetime(),
	coord: CoordinatesSchema,
	depth: z.number(),
	mi: z.number(), //moment magnitude, mi
	mb: z.number(), //body-wave magnitude
	ms: z.number(), //surface wave magnitude.
	mw: z.number(),
	li: z.string() //string list of local intensities
});

export type EarthquakeEvent = z.infer<typeof EarthquakeEventSchema>;

export function calculateDistanceinMeters(pointA: Coordinates, pointB: Coordinates) {
	const radius = 6371e3; // Earth's radius in meters

	const lat1 = (pointA.coordinates[1] * Math.PI) / 180;
	const lat2 = (pointB.coordinates[1] * Math.PI) / 180;
	const deltaLat = ((pointB.coordinates[1] - pointA.coordinates[1]) * Math.PI) / 180;
	const deltaLon = ((pointB.coordinates[0] - pointA.coordinates[0]) * Math.PI) / 180;

	const a =
		Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	const distance = radius * c; // Distance in meters

	return distance;
}

async function connect() {
	try {
		await client.connect();
		console.log(`Connected to ${uri}`);
		return client.db('sismika');
	} catch (err) {
		console.error('MongoDB connection error:', err);
		throw err;
	}
}

async function getOneAndChange() {
    const db = await connect();

    const equakeCollection = db.collection(Collection.EARTHQUAKE);

    while (true) {
        const locate = await equakeCollection.findOne({title: null});
        if (!locate) break;

        const parsedEv = EarthquakeEventSchema.parse(locate);
        console.log(`Found ${parsedEv._id?.toString()} - ${parsedEv.coord.coordinates}`)
        ok(typeof parsedEv._id === 'object')
        const title = await resolveEarthquakeTitle(parsedEv._id)

        const replace = await equakeCollection.findOneAndUpdate({_id: parsedEv._id}, {
            $set: {title: title}
        })

        ok(replace);
        console.log(`\t ^ Resolved to ${title}`)
    }
    
    console.log('Done!')
}

export async function resolveEarthquakeTitle(equakeID: ObjectId) {
	const db = await connect();

	try {
		const pipeline: PipelineType = [
			{$match: {_id: equakeID}},
			{
				$lookup: {
					from: Collection.LOCATION,
					let: { earthquakeCoord: "$coord"},
					pipeline: [
						{
							$geoNear: {
								near: "$$earthquakeCoord",
								distanceField: "distance",
								includeLocs: "coord",
								spherical: true,
							}
						},
						{$limit: 1},
						{
							$project: {
								longname: 1,
								coord: 1, 
								distance: 1
							}
						}
					],
					as: "nearestLocation"
				}
			},
			{ $unwind: "$nearestLocation"},

		]
		const earthquakeCollection = db.collection('earthquake');
		const res = await earthquakeCollection.aggregate(pipeline).toArray();

		const [first, ...rest] = res;

		const { coord } = first;
		const parsedLocation = LocationData.pick({coord: true, longname: true}).parse(first.nearestLocation);
		ok(parsedLocation.coord)

		const [startLng, startLat] = parsedLocation.coord.coordinates.map((coord:number) => coord * Math.PI / 180);
        const [endLng, endLat] = coord.coordinates.map((coord:number) => coord * Math.PI / 180);
        
        const dLng = endLng - startLng;

        const y = Math.sin(dLng) * Math.cos(endLat);
        const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
        const bearing = Math.atan2(y, x) * 180 / Math.PI;

        const norm = (bearing + 360) & 360

        const directions = [
            "South", "South-South-West", "South-West", "West-South-West",
            "West", "West-North-West", "North-West", "North-North-West",
			"North", "North-North-East", "North-East", "East-North-East", 
            "East", "East-South-East", "South-East", "South-South-East",
        ];
        const index = Math.round(norm / 22.5) % 16; // There are 16 segments
        
        const cardinality = directions[index];
        const distanceMeters = calculateDistanceinMeters(parsedLocation.coord, coord);

        return `${(distanceMeters/1000).toPrecision(2)}km ${cardinality} of ${parsedLocation.longname}` 
	} catch (err) {
		console.error(err);
		throw err;
	}
}

getOneAndChange()
//removeMany()
async function removeMany() {
    const db = await connect();

    const equakeCollection = db.collection(Collection.EARTHQUAKE);

    const remove = equakeCollection.updateMany({}, { $unset: {'title': 1}})
}
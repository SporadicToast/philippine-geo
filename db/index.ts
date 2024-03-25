import { MongoClient } from "mongodb";
import { Collection, Location, LocationData, QuerySchema, Status, Update } from "../models";

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

/**
 * Attempts to connect to the MongoDB client with the following information.
 * @returns connect
 */
async function connect() {
	try {
		await client.connect();
		return client.db('psgc');
	} catch (err) {
		console.error('MongoDB connection error:', err);
        throw err
	}
}


export async function appendInitialEntry(payload: Location) {
	const db = await connect();

	try {
		const collection = db.collection(Collection.Location);
		const exists = await collection.findOne({psgc: payload.psgc})

		if (exists) {
			console.log(`PSGC: ${payload.psgc} - Entry exists and skipping.`)
			return exists._id
		} else {
			const { insertedId } = await collection.insertOne(payload);
			console.log(`PSGC: ${payload.psgc} - Added entry.`)
			return insertedId;
		}
	} catch (err) {
		console.error(`PSGC: ${payload.psgc} -  Entry threw an error.`)
		return false;
	}
}

export async function getLocationFromPSGC(code: string){
	const db = await connect();

	try {
		const collection = db.collection(Collection.Location);
		const document = await collection.findOne({psgc: code})

		if (document === null) return false;
		return LocationData.parse(document);
	} catch (err) {
		throw err
	}
}

export async function getNextUnresolved() {
	const db = await connect();

	try {
		const collection = db.collection(Collection.Location);
		const document = await collection.findOne({status: 1}, {projection: { psgc: 1, longname: 1}})
		if (document === null) return false;
		return QuerySchema.parse(document);
	} catch (err) {
		throw err;
	}
}
export async function appendUpdatedEntry(payload: Update, psgc: string) {
	const db = await connect();

	try {
		const collection = db.collection(Collection.Location);
		const {modifiedCount}= await collection.updateOne(
			{psgc: psgc},
			{$set: {
				...payload,
				status: Status.Completed,
			}}
		)
		if (!modifiedCount) return false;
		return true

	} catch (err) {
		console.error(`PSGC: ${psgc} -  Entry threw an error.`)
		return false;
	}
}
import { appendUpdatedEntry, getNextUnresolved, getLocationFromPSGC } from './db';
import { OSMSchema, UpdateData, LocationData } from './models';

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleGeocodeRequest(query: string, code: string) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`)
        }
        const [first, ...rest] = await response.json()
        if (!first) {
            //pattern match next level
            const regionLevelPattern = /0{8,}$/
            const provinceLevelPattern = /0{5,}$/
            const municipalLevelPattern = /0{3,}$/
            
            if (regionLevelPattern.test(code)) {
                throw Error("Could not reach high level.");
            } else if (provinceLevelPattern.test(code)) {
                const parentLocation = await getLocationFromPSGC(code.substring(0,2) + '0'.repeat(8));
                const parsedLocation = LocationData.parse(parentLocation);
                return OSMSchema.parse(parsedLocation.osmresult);
            } else if(municipalLevelPattern.test(code)) {
                let parentLocation = await getLocationFromPSGC(code.substring(0,5) + '0'.repeat(5));
                if (parentLocation === false) parentLocation = await getLocationFromPSGC(code.substring(0,2) + '0'.repeat(8));
                const parsedLocation = LocationData.parse(parentLocation);
                return OSMSchema.parse(parsedLocation.osmresult);
            } else {
                let parentLocation = await getLocationFromPSGC(code.substring(0,7) + '0'.repeat(3));
                if (parentLocation === false) parentLocation = await getLocationFromPSGC(code.substring(0,5) + '0'.repeat(5));
                if (parentLocation === false) parentLocation = await getLocationFromPSGC(code.substring(0,2) + '0'.repeat(8));
                const parsedLocation = LocationData.parse(parentLocation);
                return OSMSchema.parse(parsedLocation.osmresult);
            }
        }
        const data = OSMSchema.parse(first);
        
        return data;
    } catch (err) {
        console.log("Failed to fetch data: ", err);
        throw err;
    }
}

async function goThroughAll() {
    while (true) {
        const next = await getNextUnresolved();
        if (next === false) break;
        const {psgc, longname} = next;

        const res = await handleGeocodeRequest(longname, psgc);
        const [sLat, nLat, wLong, eLong] = res.boundingbox.map(float => parseFloat(float))
        const payload = {
            coords: {
                type: "Point",
                coordinates: [parseFloat(res.lon), parseFloat(res.lat)]
            },
            boundingBox: {
                type: "Polygon",
                coordinates: [[wLong, sLat], [wLong, nLat], [eLong, sLat], [eLong, nLat]]
            },
            osmresult: res,
        }

        const parsePayload = UpdateData.parse(payload)        
        const result = await appendUpdatedEntry(parsePayload, psgc);
        if (result) console.log(`PSGC: ${psgc} ---> ${res.lon}, ${res.lat}`)
        delay(1000);
    }
}

goThroughAll()
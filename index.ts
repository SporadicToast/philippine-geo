import path from "path";
import fs from "fs";
import csvParser from 'csv-parser';
import { Location, LocationData, Status } from "./models";
import { appendInitialEntry, getLocationFromPSGC } from "./db";
import assert from "assert";

const results = new Array();

function extractRegionName(input: string): string {
    // Check if the string starts with "Region"
    if (input.startsWith("Region")) {
        // Attempt to extract the string inside the parentheses
        const match = input.match(/\(([^)]+)\)/);
        // If a match is found, return the first captured group (the content inside the parentheses)
        if (match) return match[1];
    }
    // If the input does not start with "Region" or no match is found, return the input string
    return input;
}

async function getPSGCLongName(code: string, name: string) {
    const regionLevelPattern = /0{8,}$/
    const provinceLevelPattern = /0{5,}$/
    const municipalLevelPattern = /0{3,}$/
    
    if (regionLevelPattern.test(code)) {
        return `${extractRegionName(name)}, Philippines`;
    } else if (provinceLevelPattern.test(code)) {
        const parentLocation = await getLocationFromPSGC(code.substring(0,2) + '0'.repeat(8));
        const parsedLocation = LocationData.parse(parentLocation);
        return `${name}, ${parsedLocation.longname}`
    } else if(municipalLevelPattern.test(code)) {
        let parentLocation = await getLocationFromPSGC(code.substring(0,5) + '0'.repeat(5));
        if (parentLocation === false) parentLocation = await getLocationFromPSGC(code.substring(0,2) + '0'.repeat(8));
        const parsedLocation = LocationData.parse(parentLocation);
        return `${name}, ${parsedLocation.longname}`
    } else {
        let parentLocation = await getLocationFromPSGC(code.substring(0,7) + '0'.repeat(3));
        const parsedLocation = LocationData.parse(parentLocation);
        return `${name}, ${parsedLocation.longname}`
    }
}
const psgcFile = path.join('.','PSGC-4Q-2023-Publication-Datafile.csv');

const initDump = fs.createReadStream(psgcFile).pipe(csvParser())
    .on('data', (data) => {
        const payload: Location = {
            psgc: data['psgc'],
            name: data['name'],
            longname: "",
            geographicLevel: data['geog'] ?? "",
            oldNames: data['old_names'] ?? "",
            cityClass: data['city_class'] ??  "",
            incomeClassification: data['income_class'] ?? "",
            isRural: (data['urban_rural'] === "R") ? true : false,
            population: isNaN(parseInt(data['population_2020'].replace(/,/g, ''))) ? 0 : parseInt(data['population_2020'].replace(/,/g, '')),
            status: Status.AddressParsed,
        }
        results.push(payload)
    })
    .on('end', async () => {    
        for (let i = 0; i < results.length; i++) {
            if (results[i].psgc === "") continue;
            results[i].longname = await getPSGCLongName(results[i].psgc, results[i].name)
            await appendInitialEntry(results[i]);
        }

        console.log('Resolved.')
        initDump.destroy();
    })
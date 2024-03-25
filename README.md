# PSGC Geocoder

## Overview

The PSGC Geocoder is a comprehensive Node.js application designed to parse, process, and geocode location data from the Philippine Standard Geographic Code (PSGC). Utilizing data transformations, MongoDB for storage, and OpenStreetMap for geocoding, this application enriches location data with geographic coordinates and other relevant information. This is used for [new-sismika](https://github.com/Dox-Dev/new-sismika) - An interactive Earthquake event visualizer utilizing modern web apps.

## Dumps

The PSGC entries with their Nominatim requests are available in the `dumps` folder in CSV and JSON formats.

## Features

- **PSGC Data Parsing**: Parses data from a CSV file containing location information as per the PSGC standards.
- **Data Enrichment**: Enhances parsed data with long names, geographic levels, and additional metadata.
- **Geocoding**: Utilizes OpenStreetMap's Nominatim API to fetch geographic coordinates and bounding boxes for locations.
- **MongoDB Integration**: Stores and updates location data in a MongoDB database, ensuring persistence and easy retrieval.

## Prerequisites

- Node.js (Version 14 or higher recommended)
- MongoDB (Local or Atlas)
- An internet connection for geocoding requests

## Installation

1. Clone the repository to your local machine.
2. Navigate to the project directory and run `pnpm install` to install dependencies.
3. Ensure MongoDB is running and accessible.
4. Set up environment variables:
   - `MONGODB_URI`: The URI for your MongoDB database.
   - `NOMINATIM_URL`: The URI endpoint for Nominatim.

## Usage

To run the PSGC Geocoder, follow these steps:

1. Place your PSGC data file in the `./dumps` directory. Ensure it's named `PSGC-4Q-2023-Publication-Datafile.csv` or update the file path in the script accordingly.
2. Run the script using Node.js:

   ```js
   pnpm install
   pnpm dbstart // Starts the database instance
   pnpm start //Imports the entries from the csv datafile.
   pnpm request //Proceeds with nominatim imports.
   ```

3. The script will process each entry in the CSV, enrich it with additional information, perform geocoding, and store the results in MongoDB.

## Code Structure

- **Data Models**: Defined using Zod for validation and TypeScript interfaces for strong typing.
- **Geocoding and Data Enrichment**: Functions for extracting region names, getting long names from PSGC codes, and interfacing with the OpenStreetMap API.
- **MongoDB Operations**: Functions to connect to MongoDB, insert initial entries, update entries with geocoded data, and retrieve unresolved locations.
- **Main Process Flow**: Includes CSV parsing, data enrichment, geocoding, and database updates, orchestrated in an async loop.

## Limitations

- **Rate Limiting**: The application is subject to the rate limits of the Nominatim API; excessive requests may lead to temporary blocking.
- **Data Accuracy**: The accuracy of geocoded results depends on the quality of the input data and the precision of the OpenStreetMap database.

## Contributing

Contributions are welcome. Please submit pull requests or create issues for bugs and feature requests.

## License

This project is open-sourced under the MIT License. See the LICENSE file for more details.
# Along the Course — Philly Half + Indego

A public, mobile-friendly map of Indego bike stations near the November 21, 2026 Philadelphia Half Marathon.

- Live bikes, e-bikes and open docks from Indego's public GBFS feeds.
- Refreshes every 60 seconds while open; shows feed and station timestamps.
- Marks data older than five minutes as stale. Cached counts are never presented as current after a request failure.
- Search stations, filter by distance or availability, sort, open walking directions and share a station/filter link.
- Runs entirely in your browser. No API keys, server, npm install or paid service required.

## Publish on GitHub Pages

In this repository's **Settings → Pages**, choose **Deploy from a branch**, then **main** and **/ (root)**. Save. GitHub will show the public URL after deployment.

## Run locally

Run `python3 -m http.server 4173` in this directory and open `http://localhost:4173`. Do not open `index.html` as a file: browsers block its data requests.

Run `npm test` to check distance calculations, feed joining, rental status, missing data and stale-count filtering. No dependency install is needed (Node 20+ recommended).

## Course accuracy and race access

`data/route.geojson` is an **approximate street-intersection trace**, manually derived from the [official 2026 course map](https://www.philadelphiamarathon.com/wp-content/uploads/2026/08/2026-dietz-watson-philadelphia-half-marathon-082826b.pdf). Curving roads are simplified. It is not an official GPS track, certified measurement, or navigation route. Distances and course order are estimates; use the linked official map as the authority. This can affect which stations fall near a distance cutoff.

The default includes stations within approximately 300 m (~1,000 ft), measured in a straight line. Barriers, bridges, park slopes and race closures can make walking distances longer. The map does not imply bikes can be ridden on the active racecourse. Live station status does not guarantee race-day access.

## Data and privacy

Station locations: `https://gbfs.bcycle.com/bcycle_indego/station_information.json`

Availability: `https://gbfs.bcycle.com/bcycle_indego/station_status.json`

See [Indego's official data page](https://www.rideindego.com/about/data/). A bundled station-location file is used only if the location feed fails; no historic counts are bundled. Last successful live counts are cached in the visitor's local browser storage and labeled with their original timestamps. Location is requested only when the visitor clicks **My location**; the site does not store or upload it. Walking directions open Google Maps with the station destination. Map tiles come from OpenStreetMap; those providers receive normal web requests.

## Credits

[Leaflet 1.9.4](https://leafletjs.com), BSD-2-Clause, vendored under `vendor/` with its license. Basemap © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Bike data: Indego / Bicycle Transit Systems. Independent spectator tool, unaffiliated with Indego or Philadelphia Marathon Weekend.

# Along the Course — Philly Half

A public GitHub Pages companion for the November 21, 2026 Philadelphia Half Marathon.

## Use it

1. Tap a bike station on the map, or choose **+ Pin stations**. As soon as one is pinned, all other bike stations disappear. Add as many pins as you want in the picker. **Unpin all** returns to the full nearby map.
2. Enter a racer's name or bib and pace, then press **Add** or Enter. **Paste a list** adds several at once (`Alex, 8:30`, one per line). Starts default to 7 AM; tap a racer to edit their start time, bib, pace or observed split.
3. The cheering plan appears automatically. No viewing-stop configuration is required. With no pins it chooses representative viewing spots near Indego stations. Pins limit the choices to those stations, including separate nearby course passes.

The race clock moves projected racer dots. It does not erase earlier stops from the full-morning schedule. Bike/Walk changes the transfer estimates. Plans and pins are stored on the visitor's device. **Share plan** encodes a snapshot in the link's URL fragment; it includes names, bibs, pace estimates, splits and pins. Later edits need a new link. Nothing entered by visitors is committed to this repository.

## Fair planning

The bounded multi-state search prioritizes:

1. Seeing as many distinct racers as possible once.
2. Giving as many as possible a second sighting.
3. Giving as many as possible a third sighting.
4. Fewer stops and less estimated travel.

It targets up to three sightings per racer with at most four stops. This is a balanced suggestion, not an exhaustive global optimization. Transfers require a 3-minute early/late buffer, 10 mph bike or 3 mph walking speed, straight-line distance × 1.5, and 5 minutes for bike pickup/docking. Waiting at one stop for several racers is supported. The first trip to the first stop is excluded. At most 20 representative course areas are considered if a large set of pins is selected.

## Official live view

**Official live** embeds the [official public RTRT tracker](https://track.rtrt.me/e/PHIL-MARATHON-2026), keeping its own controls and live data in RTRT's interface. It expands to fill the screen on phones. If embedding fails, use **Open separately**. Bib racers have a shortcut that copies their bib and opens this view; search the bib in the tracker.

This is not a direct API integration. The API root returns `access_denied` without a valid application ID, and [RTRT developer documentation](https://rtrt.me/docs/api) requires approved application access. No credentials are extracted, proxied or reused. The embedded tracker's favorites and live data do not sync to our planner. Our map dots remain explicitly labeled pace/split projections; manually entered observed splits refine their estimates. Official race data appears when the organizer makes it available.

## Bike data and map accuracy

Indego locations: `https://gbfs.bcycle.com/bcycle_indego/station_information.json`.

Live bikes and docks: `https://gbfs.bcycle.com/bcycle_indego/station_status.json`, refreshed every 60 seconds while the page is open. Data older than five minutes is marked stale. Missing data is never represented as zero. Bundled station locations are a fallback; no historical availability is bundled.

The course is an approximate street-intersection trace of the [official map](https://www.philadelphiamarathon.com/wp-content/uploads/2026/08/2026-dietz-watson-philadelphia-half-marathon-082826b.pdf). Mile positions are interpolated between approximate locations of published hydration mileages and the start/finish. It is not a certified GPS track or navigation route. Stations within roughly 300 metres (~1,000 ft) of the trace appear by default. Distances are straight-line estimates. Bridges, park slopes, barricades and security can prevent access. Verify race-day crossings and linked directions; today's bike count does not predict future availability.

## Run and publish

No build, install, server-side API key or paid service is required. For local preview run `python3 -m http.server 4173` in this folder and open `http://localhost:4173`. Run `npm test` for the projection, filtering, transfer and fairness checks (Node 20+).

GitHub Pages publishes from **main / (root)**. Keep `.nojekyll`. No Actions credentials or data-polling workflow are required.

## Credits

[Leaflet 1.9.4](https://leafletjs.com), BSD-2-Clause, vendored with its license. Basemap © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Bike data: Indego / Bicycle Transit Systems. Independent spectator tool, unaffiliated with Indego, RTRT or Philadelphia Marathon Weekend. Location is requested only on clicking the location button and is not stored by this site. Map tile providers and the official tracker receive normal browser requests when used.

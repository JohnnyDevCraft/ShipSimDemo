# Docking Control

The bow docking port's console (2026-10-29), on the Helm design. The berth schematic fills the space between the side panels and the controls float over it. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/docking-layout.cjs` checks those sizes and `tests/docking-control.cjs` the behaviour.

Files: `index.html`, `styles.css` and `docking.js`, minified with `../Shared/console-ui.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`; `../Shared/console.css` is the shared console look.

- **Schematic:** the berth side on, in the drawing style of Battery and Reactor Control. The **station** (Earth Orbital Station, Berth 3) and its **docking collar** are on the left; **our ship's** bow port, hull, fuel tank and ship bus on the right. Four **mooring lines** run from the station's winches to our hardpoints (amber and dashed while tensioning or slack, green when engaged, stowed in free flight). Four **clamp jaws** reach out from the collar onto our port (amber while moving, green when locked). The **gangway** inside the collar fills as it pressurizes and turns green when open. The **umbilical** pays out from our reel to the station's service socket, with **fuel** (amber) and **station power** (violet) streaming along it toward us. The tank fills as fuel arrives. In free flight the ship stands off the collar and slides in as it docks.
- **Berth (left):** docking state, station and berth, port contact, the four moorings and four clamps with lights and a count, and the gangway.
- **Services (right):** the umbilical (retracted, extending, connected, retracting, with its extension), fuel (level, rate and time to full while taking fuel), station power, life support (the ship's, or the station's over the umbilical) and the data link.
- **Advisory line:** what is happening and what to do next: approach, contact, the station's release, refuelling, low fuel.
- **Bottom bar:** **Extend / Retract Umbilical**, **Request / Stop Fuel**, **Request / Stop Power**, **Pressurize / Seal Gangway** and **Dock Log** (the requests to the station and its replies). There is no release command: the comm officer asks the station, and the station releases the ship, which this console shows. A button is green while its service runs and pulses while it is moving or waiting on the dock master.
- **Menu → Demo controls:** dock at the station (standing in for the Helm's auto dock), the station releases the ship (standing in for the comm officer's request and the station's reply), undock now, our fuel level, whether the berth has fuel and power to give, and how long the dock master takes to reply.

## Rules

- Docking: the ship closes on the berth in 4 s. At contact the station tensions the four moorings one after another (0.75 s each), then locks the four clamps (0.5 s each). The ship is then secured.
- The umbilical extends and retracts in 10 s each, and only while secured. Connected, it brings the data link and station life support.
- Fuel and power are requested from the dock master, who replies in 3 s (a demo setting) and refuses if the berth has none. Fuel fills the Reactor's 10,800-unit tank at 18 units a second (empty to full in ten minutes) and stops when full. Station power puts 40 PU on our bus and takes 10 s to disconnect.
- The umbilical cannot retract while fuel flows or station power is on or disconnecting.
- The gangway pressurizes in 8 s and seals in 4 s, only while secured.
- Release is the station's. It holds it until our umbilical is retracted and the gangway sealed (and logs why), then opens the clamps (0.5 s each) and reels in the moorings (0.75 s each); the ship backs out of the berth in 4 s and is in free flight.
- This page does not share state with the Helm, Reactor, Battery or Power Distribution yet: docking, fuel and station power here are its own.

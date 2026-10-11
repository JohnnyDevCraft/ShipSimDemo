# Navigation Control discovery preview

The navigation officer's console from the Version 3 navigation redesign. It sets destinations in the ship's navigation computer; Helm Control flies to them. Open it beside `../Helm/index.html` to see both share one computer.

Serve the whole demo folder through a local static server and open `Navigation/index.html`. `index.html` and `styles.css` are edited directly; `navigation.js` and the `../Shared/` scripts are minified from `demo-app/static-src/` by `node scripts/build-static.cjs`.

Sample state only: no live API and no simulation. Layout beyond the parts below is provisional; Version 3 has not designed it.

## What it shows

- **System map.** Pick a system, drag to pan, wheel or pinch to zoom. Click an object to make it the map target; click it again to centre on it. Rings and boundaries can be selected as exact-edge targets. Map up is toward the galactic centre.
- **Free locator.** Click empty space to drop a pin; drag it to refine. The panel reads the pin as distance and bearing from the nearest known body, and both numbers can be edited to move it. It warns when the pin is inside a body or inside its safety boundary. The pin can be set as a destination like an object.
- **Selected Destination for our ship**, with Set destination and Clear. There is no Align here; that is Helm's.
- **Plot for another ship.** Pick a known ship, set a destination for it, and read out the course, the turn from its current bearing and the jump distance. Nothing is sent to the other ship. Jump time assumes warp 1.
- **Known objects.** What the navigation computer knows, with position and, for moving ships, course, bearing and speed.
- **Demo controls** in the footer: navigation computer power, calculation seconds, Earth settlements camera preset, Reset demo.

## Rules the stand-in follows

- Destinations are held one per ship, keyed by registry number. Our ship's and a fighter's can be held together.
- Every plot takes the calculation time (default 10 seconds). One calculation runs at a time; a new plot replaces it.
- Unpowered, the computer keeps its destinations and refuses Set, Clear and plotting. The map and the known-objects list go dark.
- Our ship's destination cannot be changed while Helm Control reports it at warp.
- The computer knows three things: anything within our ship's SRS range (1 BKM); ships of our organization in our system within communications reach (stand-in 4 BKM); catalogue objects marked public. Anything else is not listed, not drawn and cannot be plotted to or for.
- Stand-in catalogue: systems, stars and Sol's hand-authored bodies are public. The generated planets Alpha Centauri I and II, Listening Post Argus and Survey Buoy 7 are not. TNS Meridian is ours but out of reach; MV Corbin Trader is not ours and out of SRS range.
- Our ship's position comes from Helm Control when that page is open. Otherwise the ship sits at its start position near Earth.
- State is kept in the browser's `localStorage` so the two pages can share it. It survives a refresh; Reset demo clears it.

Angles are shown as on Helm: courses 000.0° to 359.9°, turn signed with starboard positive.

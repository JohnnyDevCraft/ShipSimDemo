# Navigation Control

The navigation officer's console. It sets destinations in the ship's navigation computer; Helm Control flies to them. Open it beside `../Helm/index.html` to see both share one computer.

## Full-screen layout (2026-10-28)

Same design principles as Helm Control: the system map fills the window and every control floats over it, the bottom bar opens dialogs, demo-only controls sit behind the menu, and the page scales as one piece from iPad (portrait or landscape) to 4K. `tests/navigation-layout.cjs` checks those sizes, with every panel filled.

Files: `index.html`, `styles.css` (what only this console has), `../Shared/console.css` (the shared console look) and `navigation.js`, minified with `../Shared/console-ui.js` (the shared controls: vertical slider, keypad, dialogs, star backdrop, map labels, clock) from `demo-app/static-src/` by `node scripts/build-static.cjs`. Helm Control does not load the shared console files; it keeps its own copy as shipped.

- **Top bar:** emblem, the system picker (opens the Systems dialog), the grid size, stardate and clock, the navigation computer's state (Online, Calculating, Offline) and the menu.
- **System map:** map up is toward the galactic centre. Drag to pan; wheel or pinch to zoom. Tap an object to make it the map target; tap it again to centre on it. Rings and boundaries can be selected as exact-edge targets. Tap empty space to drop a pin; drag the pin to move it. The grid is fixed to the screen and centred on the middle of the map, so whatever you pan or centre there sits on the bright axes. Range circles share the grid step, and a compass rose in galactic bearings (000 up, toward the galactic centre) rings the centre. Our destination is a red reticle on a dashed line from our ship; a course plotted with Plot For is cyan, and its origin wears a dashed amber ring. The map target sits in cyan brackets.
- **Map Target (top left):** who the course is plotted for (our ship unless Plot For picked something else), then the selected object, edge or pin with course, turn and distance, and **Set Destination**. For our ship the figures preview at once. For anyone else they appear only once the computer has finished plotting that destination; a body has no heading, so its turn is "—". A course held for someone else shows under the card as one line for the navigator to read to the communications officer (or, for a body, the course and distance), with **Clear**. Nothing is sent to another ship. The ⋯ menu centres the map on the target, makes the pin the map target, opens the pin in the locator, or removes the pin.
- **Our Destination (top right):** what the computer holds for our ship, the calculation in progress, and **Clear Destination**. There is no Align here; that is Helm's.
- **Map Range (bottom right):** a slider over presets from 30 LY to 1 KM.
- **Bottom bar:** System (search the catalogue), Known (the objects the computer knows, with a filter; pick one to target and centre it), Plot For (lit amber while active: makes the map target the origin of the next course; with nothing new targeted it goes back to our ship), Locator (the pin as distance and bearing from the nearest known body, edited on the keypad, with warnings inside a body or its safety boundary, and Drop Pin at Map Centre), Our Ship (centre on it) and Range.
- **Systems and Known Objects dialogs:** the title and search box stay put and only the list scrolls, with no scroll bar shown; flick or wheel through it. Tapping the search box swaps the cards for an in-app keyboard (the system keyboard is not asked for) that filters the list as you type and shows the match count; Done, or Enter on a physical keyboard, brings the cards back.
- **Menu → Demo controls:** navigation computer power, calculation time (0, 2, 5, 10 or 30 seconds), the Earth Settlements camera preset, and Reset demo.

## Rules the stand-in follows

- Destinations are held one per ship, keyed by registry number, and one per body plotted from with Plot For, keyed by the body. Our ship's and others' can be held together.
- Every plot takes the calculation time (default 10 seconds). One calculation runs at a time; a new plot replaces it.
- Unpowered, the computer keeps its destinations and refuses Set, Clear and plotting. The map and the known-objects list go dark.
- Our ship's destination cannot be changed while Helm Control reports it at warp.
- The computer knows three things: anything within our ship's SRS range (1 BKM); ships of our organization in our system within communications reach (stand-in 4 BKM); catalogue objects marked public. Anything else is not listed, not drawn and cannot be plotted to or for.
- Stand-in catalogue: systems, stars and Sol's hand-authored bodies are public. The generated planets Alpha Centauri I and II, Listening Post Argus and Survey Buoy 7 are not. TNS Meridian is ours but out of reach; MV Corbin Trader is not ours and out of SRS range.
- Our ship's position comes from Helm Control when that page is open. Otherwise the ship sits at its start position near Earth.
- State is kept in the browser's `localStorage` so the two pages can share it. It survives a refresh; Reset demo clears it.

Angles are shown as on Helm: courses 000.0° to 359.9°, turn signed with starboard positive.

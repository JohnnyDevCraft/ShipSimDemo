# Tractor Beam Control

A new console (2026-10-29), designed on the console layout and scope look of the weapon consoles; there was no earlier screen. The scope fills the window and the controls float over it. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/tractor-beam-layout.cjs` checks those sizes and `tests/tractor-beam.cjs` the behaviour. `discovery.md` lists what is still to be decided for the tractor emitter component and the live console.

Files: `index.html`, `styles.css` and `tractor.js`; the plot draws ships with Helm's top-down image, `../Helm/assets/terran-escort-top.png`. With these in `../Shared/`: `console.css`, `scope.css` (the aim tape, scope layers, target panel and advisory), `console-ui.js`, and `scene.js`, the 3D renderer the weapon consoles use. `tractor.js` is minified from `demo-app/static-src/TractorBeam/` by `node scripts/build-static.cjs`. The page has its own scope rather than `Shared/scope.js`, which is built around weapons (shots, intercepts, shields and history); it draws the same stars, models and reticle.

- **Scope (the whole window):** stars, the 3D ships, Earth, the Moon and the Sun, and an overlay: the reticle, a box, name and range for each ship (cyan within beam range, grey beyond it, green corners while held), a faint bubble round a ship with its shields up, the station, and the beam itself, a green cone from below the view onto the held ship with pulses running up it. Without WebGL, or with `?models=0`, ships are drawn as outlines.
- **Aiming:** drag left or right (or the arrow keys) to aim all round the ship; tap a ship or body to swing onto it; pinch, the wheel or +/− to zoom. The **aim tape** runs ±180°, with the held ship's bearing in green. While the beam holds a ship, the view follows it.
- **Under the reticle:** a readout below the reticle names what is lined up and its distance (a ship, the station, Earth), and whether the beam can lock: LOCKABLE (with the power it would draw there), OUT OF RANGE, SHIELDS UP, SHIPS ONLY or NOT ENOUGH POWER.
- **Tractor Emitter (left):** power draw and available power, a load bar against the max power, the beam range, how far out the available power can hold a ship, and the move speed and turn rate in use against their maximums.
- **Position joystick (left):** up pushes the held ship away, down pulls it in, left and right swing it round us at the same distance. Range rate and orbit rate below. Dimmed until the beam holds a ship.
- **Target / Held Ship (right):** the held ship, or whatever is under the reticle: name, hull and condition, shields, range, bearing, heading relative to ours and the warp field state.
- **Tractor plot (right):** from above, our bow up: the beam range, the warp field (amber, green when the held ship is ready), the aim line and every ship drawn from above with the ship model's top-down image, to scale and turned to its heading (our own ship plain, the held ship green, lockable ships cyan, the rest grey; small ships get a minimum size), with the beam to the held ship. It closes in on a held ship.
- **Target Bearing joystick (right):** left and right turn the held ship to port or starboard; the panel shows how far its heading is off ours, in degrees.
- **Both joysticks at once:** each stick follows the finger (or mouse) that first touched it, so one thumb can move the ship while the other turns it. The keyboard also works: W/S push and pull, A/D orbit, Q/E turn.
- **Advisory line:** what to do next: line up on a ship, why the beam cannot lock, how far to pull a held ship to the warp field, which way to turn it, or ready for warp.
- **Top bar:** the beam state: standby, ready, locked, warp ready or no power.
- **Bottom bar:** Engage Beam and Release (each dimmed when it cannot be used, and a tap says why), Next Ship (swings to the next lockable ship in range) and Diagnostics.
- **Menu → Demo controls:** beam range, max move speed, max turn rate and minimum clearance; available, idle and max power; warp field radius and heading tolerance; a shield switch for each ship; add a ship nearby (up to eight); reset.

## Rules the demo follows (provisional)

- The beam locks on the ship under the reticle (within its angular size, at least 0.6°) when it is within beam range (5 km), has its shields down, and the available power can hold it at that distance. It never locks on stations, planets, moons or stars. Mass is not modelled.
- Power: holding a ship draws the emitter's idle power (1 PU) alongside, rising evenly with distance to its max power (12 PU) at the beam range: idle + (max − idle) × distance ÷ beam range. On standby the emitter draws its idle power. Moving and turning the ship add nothing.
- The available power sets the beam's reach: the full beam range at the max power or more, and proportionally less below it (6.5 PU holds out to 2.5 km). The beam cannot lock a ship, or push one, beyond that reach.
- A held ship raising its shields, or the power falling below what its distance needs, breaks the beam.
- The Position stick asks for a speed up to the max move speed (100 m/s): its up/down part along the line to us, its left/right part across it, so the ship keeps its distance while it swings round. It cannot come closer than the clearance (40 m) between hulls, or go beyond the beam range or the reach of the available power.
- The Target Bearing stick turns the ship at up to the max turn rate (6°/s). Stick values have a small dead zone in the middle.
- A held ship is ready for warp when all of its hull is within the warp field radius (500 m from our centre) and its heading is within 10° of ours.
- The demo starts with a disabled freighter (2.4 km), a powerless shuttle (1.1 km), both shields down, and Training ship A out of range (7.8 km) with its shields up; the Training Station Halcyon (14.2 km), Earth, the Moon and the Sun can be pointed at but not tractored.

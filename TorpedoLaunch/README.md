# Torpedo Launch Control

The torpedo officer's launch console, rebuilt on the Helm design (2026-10-29). It replaces the Angular TLC page; the rules are the same. The forward targeting scope fills the window and every control floats over it. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/torpedo-launch-layout.cjs` checks those sizes and `tests/torpedo-launch.cjs` the behaviour.

Files: `index.html`, `styles.css`, `../Shared/console.css` (the shared console look), `launch.js` (minified with `../Shared/console-ui.js` from `demo-app/static-src/`) and `scene.js`, the 3D models' renderer: `demo-app/static-src/TorpedoLaunch/scene.bundle.js` bundled with three.js from `demo-app/render-deps` by `node scripts/build-static.cjs`. `scripts/build-weapons.cjs` no longer writes this folder's `index.html`.

- **Scope (the whole window):** stars, the 3D Sun, Earth, Moon and training ships, and a targeting overlay, all redrawn in pixels for the window's size; the horizontal field stays 60° at 1× zoom. The reticle is fixed in the middle. Ships get a box in their affiliation's colour (red for enemies), a name and range under them, and corners when selected. Torpedoes in flight, detonations, shield flashes and destroyed ships are drawn as in the Angular scope. The yellow circle is the predicted intercept for the selected ship: put it under the reticle and launch. Without WebGL, or with `?models=0`, ships are drawn as outlines.
- **Aiming:** drag left or right on the scope (or use the arrow keys) to aim within the 60° acquisition arc. The **aim tape** at the top shows the aim across the arc and the intercept bearing in yellow.
- **Selecting:** tap a ship, or a body, to select it. **Clear Target** in the bottom bar clears it; a ship that slips out of sight is dropped.
- **Launcher (left):** the tube, drawn with the torpedo sliding in as it loads, with Arm (Safe) and Launch, the load cycle, torpedo speed and lifetime, and the prepared torpedoes with Load buttons.
- **Target (right):** the selected ship's range, bearing, intercept time and bearing, and whether the intercept is inside the arc; shield SEO on each side (forward, starboard, aft, port) around a hull icon, hull integrity and any subsystems knocked out. For a body: its kind, radius, distance and bearing.
- **Zoom (right):** 1× to 20× on a vertical slider; a pinch or the wheel on the scope zooms too.
- **Advisory line:** what the firing solution needs: tap a ship, no intercept, outside the arc, align the reticle with the yellow circle, or on target.
- **Bottom bar:** History (fired torpedoes, with a count), Auto Arm, Auto Load, Delegate Launch, Delegate Aim and Clear Target. The toggles light while on; delegated controls light amber. Launch and Arm, when they cannot be used, are dimmed and a tap says why. Space or a right-click on the scope also launches.
- **Menu → Demo controls:** add a random ship, pause ship movement, torpedo speed, available power, load times, ready capacity, add prepared torpedoes, auto prepare, and the bridge's stand-ins: bridge aim and bridge launch.

## Rules (from the Angular TLC demo)

- One torpedo loads at a time; loading clears the arm. The load takes the maximum load time (5 s) at 10 PU and the minimum (1.5 s) at 24 PU; below 10 PU it pauses. The launcher's share of power is half the available power, up to 12 PU.
- Launch needs a loaded, armed torpedo, the aim inside ±30° and local launch control. A delegated launch comes only from the bridge; delegated aim cannot be dragged.
- Auto Load loads the oldest prepared torpedo whenever the tube is empty; Auto Arm arms whatever is loaded.
- Torpedoes fly at the torpedo speed (10 km/s) on the aim's bearing for 60 seconds, then detonate. A proximity warhead detonates within its distance of a ship.
- A hit on a quadrant with shields drains that quadrant's SEO by the warhead's WED (50 SEO a quadrant); with that quadrant down it hits the hull for the WKD and damages a random subsystem on that side. Hull integrity is 500. Shields recover 10 SEO a quadrant every 15 seconds while the shield generator works. Losing the impulse engine leaves a ship coasting to a stop; losing the reactor may destroy it.
- The intercept is the constant-course solution for the selected ship at the torpedo speed, within the torpedo's lifetime and 50,000 km.
- Ships hold still until the 3D models have loaded.
- The page starts with three prepared warheads (50% yield, impact) for the demo; the Angular page started empty. Reset demo reloads it.

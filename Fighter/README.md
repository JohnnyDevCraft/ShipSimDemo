# Fighter Control

A new console (2026-10-29) on the console layout, for the pilot of a TSC Fighter Mk1. The forward scope (`../Shared/scope.js`, shared with Torpedo Launch, EPW and EBW Control) fills the window and looks along the nose, so the view turns with the ship and the weapons fire where the nose points. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/fighter-layout.cjs` checks those sizes and `tests/fighter-control.cjs` the behaviour. `discovery.md` explains where the design comes from and what is still to decide.

Files: `index.html`, `styles.css`, `../Shared/console.css`, `../Shared/scope.css` and `fighter.js`, minified with `../Shared/console-ui.js`, `../Shared/scene.js` and `../Shared/scope.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`.

- **Scope (the whole window):** stars, the 3D ships and the reticle along the nose. Tap a ship to target it, and pinch or scroll to zoom. A yellow circle marks where to point the nose to hit the target, allowing for its motion and ours. The flight-path marker shows where we are actually going: green on the nose, amber when drifting, and an arrow at the edge ("DRIFT 90°") when it is off the screen.
- **Heading tape:** the compass slides under the nose mark. Amber marks the way we are moving and yellow marks the intercept.
- **Shields (left, top):** our four shield quadrants (forward, starboard, aft, port) as a ring around the hull, drawn as on Tactical Officer Control, and the hull.
- **Flight (left, below):** speed, course and drift, then the flight stick. Left and right turn the nose. Up and down change the speed along the way we move, and centred holds it. Below the stick, **Forward Thrust** (held) swings the momentum onto the nose at the same speed, and **All Stop** sheds all motion.
- **Target (right):** the scope's target panel: range, bearing, intercept and the target's shields.
- **Weapons (right):** the cannon's capacitor, with a tick at every shot's worth of charge, and the shot power (30, 60 or 120 PU). Then the torpedo rack (it loads itself), Fire Cannon and Torpedo.
- **Bottom bar:**
  - **Engines** opens the pop-up: Start or Stop Engines, the reactor (a 90 s cold start), the battery, the bus load, and every system's power, asked and given.
  - **Shields** and **Weapons** switch on and off.
  - **Auto-Drift** keeps the motion on the nose: as you turn, the engine does Forward Thrust's work by itself, and the stick sets the speed along the nose (down through zero reverses along it).
  - **Next Target**, **Clear Target** and **Zoom**.
  - **History** (shots fired) and **Diagnostics**.
- **Multi-touch:** steer with one finger while others fire, launch, hold Forward Thrust or press the bottom bar. The console's buttons act the moment a finger lands, so they work while the stick is held, and page pinch and zoom are off.
- **Keys** (rebind them in Menu → Controls; kept in this browser): A and D turn at half rate, Q and E at full rate; W accelerates and X slows and reverses, both at half rate; S is full stop; C goes to max forward speed and Z to max reverse (the throttle cancels the order); F (held) is forward thrust; V toggles auto-drift, B weapons and N shields; ← fires the cannon and → launches a torpedo; Tab picks the next target. Clear target, shot power, engines and zoom can be given keys too. Space also fires and + and − zoom unless those keys are bound. A joystick or game controller also works (a first pass).
- **Menu → Demo controls:** flight ratings, reactor rating, ignition time, battery output, cannon charge rate, add a ship, pause the ships, enemy fire, take a hit, rearm and repair.

## Rules the demo follows (provisional)

- **Power:** the battery (10,000 PU, 40 PU out) runs life support, communications and sensors. The pocket reactor (120 PU, 90 s cold start) runs everything once lit and recharges the battery. Systems get power in this order: life support, comms, sensors, dampener, impulse, shield, torpedo, cannon. The engine needs the dampener's full 26 PU.
- **Flight:** 2,500 m/s ahead, 500 m/s astern, 150 m/s² and 30°/s (demo values). There is no drag. Turning does not turn the momentum, unless Auto-Drift is on: then the engine pushes the velocity toward the set speed along the nose at its full acceleration (the same push as Forward Thrust), so a quick turn still drifts for a moment while the motion catches up.
- **Cannon:** a 240 PU capacitor charging at 50 PU/s. Each shot takes its shot power and does that share of 40 WED / 30 WKD (full at 120 PU). Pulses fly at 25 km/s out to 100 km, at full damage to 50 km.
- **Torpedoes:** 12 pre-built rounds, each loading in 1.5 s, flying at 1,250 m/s for 60 s, 30 WED / 120 WKD.
- **Shields:** 1,000 SEO in four 250 SEO quadrants. A hit lands on the quadrant facing the shooter, and the hull takes what the quadrant cannot hold. Recharging draws 20 PU instead of 10 and gives each quadrant 1.67 SEO/s.
- The fighter is its own ship, so it does not show the mothership's NON-HABITABLE notice.

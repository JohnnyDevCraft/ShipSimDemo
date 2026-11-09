# EBW Control (Phaser Array)

The energy beam weapon console, rebuilt on the Helm design (2026-10-29). It replaces the Angular EBC page; the rules are the same. It shares the full-window targeting scope with Torpedo Launch and EPW Control: see `../TorpedoLaunch/README.md` for the scope, target readout, zoom, aim tape, history and Delegate Aim. The page scales from an iPad in landscape to 4K; `tests/energy-weapons-layout.cjs` checks those sizes and `tests/energy-weapons.cjs` the behaviour.

Files: `index.html` (with `<body data-weapon="array">`), and in `../Shared/`: `console.css`, `scope.css`, `energy-weapon.css`, `console-ui.js`, `scene.js` (the 3D models), `scope.js` (the scope) and `energy-weapon.js` (this weapon panel, shared with EPW Control), minified or bundled from `demo-app/static-src/Shared/` by `node scripts/build-static.cjs`. `scripts/build-weapons.cjs` no longer writes this folder's `index.html`.

- **Phaser array panel (left):** shot power (1–100%) on a vertical slider, with the WED and WKD it gives, beside the capacitor, filling amber as it charges, with the shot power marked across it. Below: supply, recharge time to the shot power, the beam's length and reach, last shot and shots fired; then Arm (Safe) and Fire Beam.
- **Aiming:** all round, ±180°. The beam is drawn from the emitter below the view up to the reticle while it fires; the status reads FIRING.
- **Bottom bar:** History, Delegate Fire, Delegate Aim and Clear Target. Fire, when it cannot be used, is dimmed and a tap says why. Space or a right-click on the scope also fires.
- **Menu → Demo controls:** add a random ship, pause ship movement, supply level, full- and minimum-power charge times, max WED and WKD, bridge aim and bridge fire.

## Weapons fire (2026-11-02, rebuilt 2026-11-03)

John: weapons fire must come from real ships, reach no further than weapons do, and show on the scopes the way the weapon consoles draw their own shots. The demo's engagement (`../Shared/demo-battle.js`): two Ash Corsairs raiders (*Corsair Vex*, *Corsair Mako*) and two Terran Space Command ships (*TSC Valiant*, *TSC Ardent*) weave 25 to 45 km ahead of where the page started, at 120 to 340 m/s, from page load, and fight each other by the weapon consoles' rules: phase cannon ±45° within 25 km (pulses at 15 km/s that dissipate at 90 km), torpedoes ±30° within 50 km (10 km/s for 60 s), phaser array all round within 100 km (a one-second beam). Terran fire computers lead their target; the raiders aim where it is. A shot starts at its shooter and hits the first shield its path meets (hull half-length + 20 m), or flies on. Now and then a raider fires a torpedo at us, led to where we will be. Shields take every hit, so nobody is destroyed. Paths and fire follow the wall clock, so pages opened together agree. **Menu → Demo controls → Engagement: on/off** (every tab follows), or `?battle=0`. `DemoBattle.drawn[view]` holds what a view drew in its latest frame (`tests/weapons-fire.cjs`).

On the targeting scope (`../Shared/scope.js`) the four ships are contacts beside the training ship: drawn like it (3D model or outline, boxed red for a raider, green for Terran Space Command, named, with range), tappable as targets with a firing solution, and hit by our shots (they never fall below a fifth of their hull here). Their fire is drawn the way the scope draws ours, in the line of view: a pulse a glowing 1 × 2 m cylinder (pink for a raider's), a torpedo its 3 m body, a beam a warm glow (pink for a raider's), a detonation an orange burst, a shield a pale blue sphere; far off, a shot smaller than a pixel is a small glowing dot where it is (our own shots too). The world is flat: the ships and their fire are on the horizon; labels keep clear of the bodies and the reticle.

## Rules (from the Angular EBC demo)

- The capacitor charges toward the shot power. A full charge takes the minimum-power time (6 s) at 1% supply and the full-power time (2 s) at 100%; 0% supply pauses charging.
- Firing needs the array armed, local fire control, no beam already firing and the capacitor charged to the shot power, which the shot spends.
- The beam hits at once and lasts one second, following the aim. Each moment it damages the first ship along it, out to 100 km: full damage (60 WED, 60 WKD a second at 100% shot power) to 50 km, falling to a tenth at 100 km. Shield and hull hits work as for torpedoes.
- The intercept is the ship's present bearing, within 100 km.

## Combat (as the live console in MissionProtocol 1.0.0-Beta9/Beta10)

As EPW Control (see `../PhaseCannon/README.md`): the capacitor is the phaser array EBW1; `range-halved` halves the beam's reach to 50 km and marks BEAM "(halved)"; the targeting computer offline pill; LOCK (a beam fired at the lock follows the locked target); stations and settlements with their shields; hostile and wrecked ships; the shot split in LAST SHOT and History; Menu → Phaser arrays.

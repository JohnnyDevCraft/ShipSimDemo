# Fighter Control: the first design, and what is still to decide

## Where it comes from

- **ShipSim V3 catalog:** the *TSC Fighter Mk1 Class* (hull *Terran Fighter Mk1*: 9 m, 20 t, bus 150 PU, 8 g) fits a Terran Pocket Generator (120 PU), the Mark I impulse engine, a Warp 1 Jump Drive, the Pocket Shield Generator (1,000 SEO, 10–20 PU), Pocket Inertial Dampeners (26 PU), Pocket Life Support (5 PU), communications, long- and short-range sensors, a 10K battery (10,000 PU, 40 PU out) and the Phase Cannon Pocket 1 (bow, 5° arc, 240 PU capacitor charging at 50 PU/s, 10–120 PU a shot, 40 WED / 30 WKD, 25 km/s pulses, 100 km). The *Fighter* classification says one energy weapon and one torpedo launcher; the Pocket Torpedo Launcher (12 pre-built rounds, auto-load 1.5 s, 1,250 m/s for 60 s, 30 WED / 120 WKD) is built for fighters.
- **ShipSim V2's prototype Fighter Console** (`artifacts/aspire-fighter-console.png`): propulsion (impulse, warp, coil charge), attitude (steer, roll, brakes, orbit lock), weapons (shot power, fire), ship status (hull, core temperature, efficiency, containment), backup battery and power relays.
- **John (2026-10-29):** most fighter systems are autonomous. The pilot gets start/stop engines (lights the pocket reactor), weapons online, a joystick (left/right turns the nose, up/down accelerates or slows and reverses, centred holds the velocity), a way to deal with drift (Forward Thrust), weapons and shields. No target scanning: the guns fire where the nose points. The view is the shared scope. A real joystick is coming. Then: the engines and battery go in an *Engines* pop-up, Shields and Weapons are bottom-bar commands, our shield shows its four quadrants as on Tactical Officer Control, and a cold start takes about 1.5 minutes.

## The flight model (as built)

| Control | What it does |
| --- | --- |
| Stick left/right | Turns the nose at up to the turn rate. The momentum does not turn with it. |
| Stick up/down | Changes the speed **along the way we are moving**: up adds speed when we move ahead of the beam and takes it off when we move astern; down the reverse. It stops at zero before reversing; from a standstill it pushes along the nose. |
| Stick centred | Holds the velocity (no thrust, no drag). |
| Forward Thrust (held) | Swings the momentum onto the nose and keeps the speed we had when it began: the engine pushes toward "this speed, along the nose" at its acceleration. A 90° drift at 900 m/s takes 8.5 s at 150 m/s²; a full reversal passes through a stop. While held, the stick sets the speed to keep. |
| All Stop | Retro thrust until still. Moving the stick or thrusting cancels it. |
| Auto-Drift (bottom bar, G) | Forward Thrust all the time: the engine pushes the motion onto the nose as it turns, and the stick sets a signed speed along the nose (up ahead, down through zero to astern). A 90° turn at 750 m/s catches up in about 7 s at 150 m/s². |
| Engines off | Coasting: the momentum stays; the stick is locked. |

Demo ratings: 2,500 m/s ahead, 500 m/s astern, 150 m/s², 30°/s.

## Power (as built)

The battery runs life support, communications and sensors (8 PU) while the engines are off. Start Engines cold-starts the pocket reactor in 90 s; once lit, the dampener comes on and the engine, shields and weapons can run. Power reaches the systems in order (life support, comms, sensors, dampener, impulse, shield, torpedo, cannon); the reactor covers up to 120 PU, the battery up to 40 PU more, and spare reactor output recharges the battery. Short power slows the cannon's charge first. Without its full 26 PU the dampener stops the engine. Full thrust, recharging shields, a loading torpedo and a charging cannon ask 148 PU, so a hard fight drains the battery.

## Things to decide

1. **Flight ratings.** The catalog fits the escort's Mark I impulse engine (20 km/s, 100 g, 3°/s). A fighter needs its own engine: what top speed, acceleration and turn rate? 20 km/s crosses the training ship's 20 km range in a second.
2. **Forward Thrust's shape.** Built: the shortest change of velocity (speed dips mid-swing). Alternative: the velocity turns at constant speed (a banked arc, slower to reverse). Auto-Drift (John, 2026-10-29) is the automatic version and uses the same push. Should Auto-Drift cost more power, or be limited to a share of the engine so manual flying stays faster?
3. **Throttle feel.** Up/down changes the speed directly at full acceleration. Should the stick instead set a *target* speed (a throttle setting) that the engine reaches?
4. **Cold and warm starts.** A cold start takes 90 s. Should a restart soon after shutdown be quicker (a warm reactor), and should the ignition draw on the battery?
5. **Fuel.** The pocket generator has a fuel flow (0.25); the fighter has no fuel tank fitted. Fuel, and refuelling in the carrier's bay, are not modelled.
6. **Torpedoes.** The Fighter Mk1 hull has no torpedo slot yet; the demo fits the Pocket Torpedo Launcher anyway.
7. **Gimbal.** The cannon's 5° firing arc could let it aim within 5° of the nose at a selected target. Built as nose-only, per "it fires wherever your nose is pointing".
8. **Shield quadrants.** The pocket shield is one generator; the demo splits its 1,000 SEO into four 250 SEO quadrants, each recharging a quarter of 6.67 SEO/s (read as 0.667% a second). Should the pilot be able to shift strength between quadrants, as Shield System Control does?
9. **Other panels to bring up:** the **Warp 1 Jump Drive** (charge the coils for 3 s and jump: home to the carrier); **Communications** (carrier and wingmen: request landing, form up, target calls); **Landing / docking** with the carrier's bay (V3 Docking Bay: launch and recovery times); a **radar** (top-down, all round), since the forward view shows nothing behind; **countermeasures**; **eject**; **damage and repair** (V3 components have integrity).
10. **Keys and joystick.** Keyboard bindings are John's defaults (2026-10-29) and can be rebound per browser; the live console might keep them per pilot. A joystick needs the same: a mapping screen. A first pass reads a standard-mapping controller: stick to turn and throttle, button 1 fires, 2 launches a torpedo, 3 (held) thrusts, 4 is all stop. Needed: a mapping screen, flight sticks with a throttle axis and twist, and dead-zone and curve settings.
11. **Life support and habitability.** The fighter is its own ship with pocket life support, so it does not show the mothership's NON-HABITABLE notice. A flat battery with the engines off should eventually make the fighter uninhabitable.
12. **Enemy fire.** The scope's training ships do not shoot. The demo's *Enemy fire* stands in: an enemy within 60 km hits the quadrant facing it every 4 s.
13. **The live console.** The server should own the fighter's motion, power and hits; this page would send the stick, thrust, all stop and the commands.

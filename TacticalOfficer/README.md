# Tactical Officer Control

The tactical officer's console (2026-10-29), on the Helm design. It replaces the Angular weapons demo's TOC page (`demo-app` `weapons-demo`, route `/demo/toc`) and keeps its engagement with the training ships. The tactical scanner fills the window and the controls float over it. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/tactical-officer-layout.cjs` checks those sizes and `tests/tactical-officer.cjs` the behaviour.

Files: `index.html`, `styles.css`, `tactical.js` and `camera.js`, minified from `demo-app/static-src/` by `node scripts/build-static.cjs`. It also uses `../Shared/console.css` and `../Shared/console-ui.js` (the console look and controls), `../Shared/nav-world.js` (the chart) and `../Shared/view-screen-settings.js` (the bridge view screen's settings).

- **Tactical scanner (the whole window):** heading up, as on the Helm's SRS view: our ship at the centre of a compass rose in relative bearings, spokes every 30°, range rings with their distances, and the chart's bodies and stations. Our four shield quadrants show as arcs on the rose and the view screen camera's field as an amber wedge. Training ships are chevrons: green while unknown, red once identified as enemies (a dashed ring marks the 100 km identification distance), and enemies beyond the window are marked at its edge. The selected target pulses and carries hull and shield bars. Shots, beams, shield flashes, explosions and destroyed ships are drawn where they happen. **SRS / LRS** in the top bar; the **range** slider on the right (1 km to 1 BKM on SRS, 1 BKM to 30 LY on LRS) or the mouse wheel. Tap a contact to select it.
- **Weapons (left):** six buttons, red when ready to fire: phaser cannons 1 and 2 (forward ±45°), torpedo 1 (forward ±30°), torpedo 2 (aft ±30°), phaser array 1 (all round, 100 km) and phaser cannon 3 (aft ±45°). Each shows READY, NO TARGET, OUT OF RANGE, OUT OF ARC, CHARGING or LOADING, with its recharge bar.
- **Shields (left):** our four quadrants as a ring around the hull with their SEO, whether the shields are on, the total, the generator, and the hull.
- **Target (right):** enemy or unknown, distance, speed, bearing and turn, and after a detailed scan the hull, weapons (armed or safe), people aboard and warp coils; its four shield quadrants always; the scan's progress; and the targeted subsystem, LOCKED (gold) or NOT LOCKED (amber).
- **Advisory line:** ship destroyed, hull critical, shields off, incoming fire, the target and how many weapons are ready, scanning.
- **Bottom bar:** **Scan Target**, **Subsystems** (the target's nine subsystems once scanned; tap one to target it at any range, tap again to clear), **Clear Target**, **Shields** (on and off: green when on, red when off), **View Screen** (the camera) and **Condition** (readiness I to V, also shown in the top bar).
- **View Screen camera:** a joystick like the Helm's, with two axes: left and right swing the camera around the ship (a full 360°, up to 90° a second), up and down zoom in and out (1× to 20×, up to 2^1.2 a second). The further it is pushed the faster it goes; let go and it springs back and holds; the arrow keys push it halfway. **Forward**, **Starboard**, **Aft** and **Port** jump straight to those views. A dial shows the ship from above with the camera's field, and the bearing and zoom are read out. The bridge View Screen follows at once.
- **Menu → Demo controls:** stand-ins kept off the console: enemy impulse and behaviour (attack or run), add a random training ship (up to eight), charge the target's warp coils, enemy contacts and enemies known on entry; our impulse and navigation (follow the enemy or move away); the detailed scan's distance and time, people aboard and whether the target is armed; and every weapon setting (power or yield, speed, targeting range, the cannon's full-power and dissipation distances, the torpedo's lifetime). **Reset demo** starts again.

## Rules (from the Angular TOC)

- The simulation steps ten times a second. Impulse is 20,000 m/s at 100%; turn rate is 3°/s up to 56% impulse, falling to none at 75%.
- **Our flight:** we steer at the selected ship, or the first surviving one (or directly away from it), at our impulse.
- **Training ships** attack (head for us, break off at 200 m, come back from 5 km) or run. Any downed shield quadrant sends them away, turning off a downed aft quadrant. With the impulse engine out a ship coasts to a stop in 10 seconds. They fire their torpedo (50 km, ±30°), cannon (25 km, ±45°) and array (100 km) at us at half our power settings, unless their sensors are out; running ships fire only once their impulse engine is out.
- **Our weapons:** cannons 120 WED / 40 WKD a pulse at 15,000 m/s, recharging 1.5 s (both scaled by power), full damage to 50,000 km and none at 90,000 km; torpedoes 30 / 150 at 10,000 m/s for 60 s, loading 2.5 s; the array 60 / 60 a second for one second, recharging 2 s, falling from full at 50 km to a tenth at 100 km. Every shot is led to where the target will be, using its velocity relative to ours.
- **Hits:** a shot meeting a shield quadrant that is up drains it; otherwise it damages the hull and a subsystem on that side (the targeted one if there). Within 5 km a shot at a targeted subsystem strikes it alone. Losing the reactor may destroy the ship. Training ships have 50 SEO a quadrant (recovering 10 every 15 s) and a 500 hull.
- **Scans** reach 30,000 km and take 3 s, three times as long while any shield quadrant is up.
- **Subsystem targeting:** once a ship is scanned, a subsystem can be picked at any range. The pick locks only while the ship is within 25 km (announced as the lock is gained or lost), and shots aim at it only while it is locked; within 5 km a locked shot strikes it alone.
- **Our shields:** 100 SEO a quadrant, recovering 10 a second while on; the quadrant facing the shooter (measured from our bow) takes the hit, and with it down or the shields off the hull does. At zero hull the simulation ends.

## Changes from the Angular page

- The enemy's hits land on the quadrant facing the shooter from our bow (the Angular page ignored our heading).
- The lead allows for our own motion, the array's beam stays on its target, and a miss-tap on LRS no longer re-selects an older pick.
- A body's distance and bearing are measured from where we are now.
- The scanner opens at 200 km so the training ships 110 km out are in view.
- Shields on and off moved from the shields panel to the bottom bar.
- A subsystem can be picked as soon as the scan completes; it locks within 25 km (the Angular page refused the pick until then).

**Scanner range (John, 2026-11-03):** the RANGE slider is gone. The scanner zooms by the scroll wheel, a two-finger pinch and the zoom keys (= or + in, − out); the subtitle and the rings show the range.

## Combat (live 1.0.0-Beta9/10, 2026-11-09)

Ported from the live console's "Beta9 combat"; the critical damage and station shields are the shared demo state (`../Shared/demo-combat.js`, Menu → **Critical damage**, shared by every console in the browser).

- **Hostile ships:** an identified enemy is red with a dashed red ring and `HOSTILE · <distance>`; the target chip reads HOSTILE, HOSTILE · LOCKING (detailed scan running) or HOSTILE · LOCKED (scanned), and the subtitle "· hostile". Other ships read UNKNOWN (enemy contacts on, not yet identified) or CONTACT, then LOCKING / LOCKED. The locked target and hostile ships beyond the window get an edge arrow.
- **Wrecks:** a destroyed ship stays on the scan as a dim grey chevron, `WRECK · <distance>`, chip WRECK. It stops; no one fires at it or from it, and it cannot be scanned.
- **AUTO TARGET** (bottom bar): selects the nearest identified hostile in reach and sight, else the nearest ship, and starts its detailed scan. Disabled ("Auto target unavailable (critical damage)") while the targeting sensors carry that effect.
- **Critical damage:** the weapons panel lists the targeting sensors' and each weapon's effects, a weapon card with one shows CRIT; *Range halved* halves the range OUT OF RANGE uses (the list gives the halved figure against the design's). **TARGETING COMPUTER OFFLINE** shows at the top of the weapons panel: the shots lose their lead (they go where the target is now) and the advisory says to aim by hand. The shields panel lists the generator's effects: *SEO halved* halves every quadrant, *One shield quadrant disabled* takes out the port quadrant.
- **Last hit on us:** for 8 s in the shields panel (side, kind, hull damage, what the shields stopped, the component struck, any critical, who fired; "<SIDE> SHIELDS HELD" when the shields took it all), said when it lands, and that side's arc on the compass flashes. A hull hit strikes one of our components for half its kinetic damage; a heavy one (a torpedo at full yield) gives it a critical effect, which every console then shows.
- **Station shields:** a ring at a station's shield radius on the short range scan (dashed when lowered or drained) and `SHIELD UP nn%` / `SHIELD DOWN nn%` / `SHIELD DRAINED` in its label; a selected station shows a SHIELD row. **Scan Target** on a station locks the targeting sensors on it (the scan time, once within their reach); our weapons then fire at it and drain its shield.
- **Menu → Sensors:** power (0–100 %) of the targeting sensors (1 km to the Demo controls' scan distance; the detailed scan needs the target within it), short-range sensors (10,000 km to 1 MKM; the SRS shows ships within it) and long-range sensors (0.001 to 3 LY), with their reach and any critical damage.
- The bottom bar is a little tighter (seven commands), and the left panels scroll inside their column if every effect is on at once.

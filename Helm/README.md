# Helm Control

## Full-screen layout (2026-10-28)

The scanner map fills the window and every control floats over it. Readable source: `demo-app/static-src/Helm/helm.js`, minified to `helm.js` by `node scripts/build-static.cjs`. Styles: `helm.css`. (`styles.css` is the earlier Helm stylesheet; Navigation Control still loads it, so leave it in place.)

- **Top bar:** emblem (back to the demo index), LRS / SRS, stardate and clock, ship state, and the menu.
- **Propulsion (left):** Impulse and Warp tabs. Impulse is a 0–100% slider. Warp is set in warp factors from 0.25 up to the ship's rating (Warp 6 by default), with the coil charge, Charge Coils and Engage / Exit Warp under a shorter slider. The rules are unchanged: charged coils, zero impulse and alignment within 0.05° to engage; leaving warp discharges the coils.
- **Heading (bottom left):** the heading and a left/right joystick, no status text. Hold the joystick (or the arrows, or the arrow keys) to turn; release and the turn eases to zero. Tap the heading for the Change Heading keypad.
- **Selected Target (top right):** navigation's destination, or the helm's own course from Course or Plot, with bearing, turn, distance and ETAs at current speed, at the warp factor set and at maximum warp. Align To Course turns to it. The ⋯ menu returns to navigation's destination or discards the helm course. × folds the panel to a chip.
- **Map Range (right):** a slider over the range presets. LRS runs 50 LY to 1 BKM; SRS runs 1 BKM to 1 KM. The mouse wheel and pinch zoom too.
- **Dock (bottom):** Docking (Auto Dock / Undock, umbilical and indicators), Course (relative course, distance and KM / BKM / LY, each entered on a keypad, then Save Course), Plot (galactic coordinates, plotted by the navigation computer in its calculation time) and Range (jump straight to a preset). After a divider come Reverse (a toggle that lights up while on; reverse impulse is capped at 10%), Light Brake and Hard Brake (hold to apply) and Full Stop.
- **Menu → Demo controls:** ship warp rating, navigation computer power, send a destination as Navigation would, move the ship next to Earth Orbital Station or back to the start, and reset the demo. These are demo aids, not helm functions.

The map is heading-up, and the compass rose around our ship shows relative bearings: 000 is always dead ahead, 090 starboard, 180 astern, 270 port. The ship's own heading is in the Heading box. The long range scan is drawn as a radar: distance is measured outward from the compass hub, so nearby stars sit clear of it. The short range scan stays true to scale so bodies, rings and safety boundaries line up.

The page scales as one piece: sizes are in rem and the root font size follows the window (`min(1.25vw, 2vh)` in landscape, `min(2.08vw, 1.56vh)` in portrait). `tests/helm-layout.cjs` checks iPad portrait and landscape through 4K.

Four stars were added to the shared world for this layout: Barnard's Star, Wolf 359, Sirius and Tau Ceti, with spectral classes in `NavWorld.starClasses`. Navigation Control lists them too.

## Earlier notes

## Navigation split (2026-10-10)

This page follows the Version 3 navigation redesign. Navigation is its own console now: see `../Navigation/README.md`.

- Map tabs are LRS and SRS. The system map moved to Navigation Control, and so did the Earth Settlements camera preset, the navigation computer power toggle and the calculation-seconds control.
- The Selected Destination widget shows what the navigation computer holds for our ship (name, course, turn, distance, time at current speed). Its only button is Align. Helm cannot set or clear the destination.
- Manual Navigation stays. A typed course is the helm's own manual course, shown in that panel with its own Align button; it does not change the navigation computer's destination. Galactic coordinates still need the navigation computer powered and still take its calculation time.
- Change Heading puts the helm on a free course. Align on the widget returns it to navigation's destination. A new destination from navigation takes over from a manual or free course.
- Warp still needs charged coils, zero impulse and alignment within 0.05 degrees of whatever the helm is steering to, and still stops at the safe arrival point.
- The navigation computer is shared with Navigation Control through the browser's `localStorage`, so its state survives a refresh. Reset demo in the footer clears it.

Sections below that mention the System view, the destination buttons or the Earth Settlements preset on this page describe the earlier preview; that behaviour now lives on Navigation Control.

## Earlier preview notes

Earth surface settlements: the footer's Earth Settlements camera preset centers Earth for review. SRS and System views show eight two-pixel yellow dots on the physical rim below 20,000 km radius, with labels at 10,000 km and closer. Click a dot for distance and Mark I range/line-of-sight status. Names: Paris, Jerusalem, Moscow, Hong Kong, Tokyo, San Francisco, St. Louis, Port Canaveral. Bearings are equally spaced fixtures, not geographic coordinates. The shared requirements for future live maps are captured in the Transporter discovery notes.

Open index.html through a local static server serving the whole demo folder (the page loads `../Shared/` scripts). No build is needed to view it. The scripts are minified from `demo-app/static-src/` by `node scripts/build-static.cjs`; assets/ is reserved for screen assets. Map graphics are canvas-drawn.

Sample state only: no live API, no persistent data, no actual simulation. Example hull turn rate 10°/s, 20% dampener boost, 8-second charge. Coil reset on exit and braking timing are preview assumptions. No damaging overdrive. Contact bearings and closest-zoom contacts are illustrative. Real barycentric coordinate transforms, boundary validation, power allocation, inertial motion and sensor eligibility belong to later implementation. Galactic entry demonstration assumes Sol at (0,26000) LY with system zero toward galactic center; exact game coordinates still need consolidation.

Review flows: select LRS/System/SRS; zoom; enter a course and align; steer manually; increase impulse to block charging; lower impulse to zero, charge, engage warp; adjust warp factor while engaged; select SRS to see blank warning; exit warp. Warp disables turning and impulse.

System view centers on the selected LRS system (defaults to Sol), with a per-system full extent. Sol includes eight illustrative static planet placements; other systems currently show only their center pending catalog detail. Their extents are preview placeholders. LRS includes a selectable Sol center at the current ship location.

Automatic course alignment ramps angular velocity up and down at an illustrative 5 degrees per second squared, capped at the hull-safe 10 degrees per second. Remaining angle determines braking; the steering slider follows the commanded rate. Zero Turn cancels alignment and smoothly eases the current angular rate to zero; the slider follows the slowdown.

Safe arrival preview: planet targets stop outside their maximum high-orbit boundary, provisionally radius plus the larger of 36,000 km or six body radii. Stars use a shield-danger boundary at ten stellar radii and an illustrative stellar-layer ring at 1.1 radii. Arrival adds 1% boundary clearance (minimum 1 km), clamps remaining distance to zero when already inside, and retains center coordinates. System markers still target barycenters. These are adjustable gameplay placeholders, not astrophysical safety limits. Rings appear in System/SRS when resolved, not LRS. Stellar layer terminology awaits confirmation (user said chronosphere).

Local propulsion demo now integrates a shared ship position in kilometers using impulse and warp settings, independent of backend power/resources. Starts near Earth. LRS/SRS translate contacts relative to the ship; System stays at selected system origin and displays the ship in blue when in range. No enemies are seeded. Sublight drift persists with zero throttle and after warp exit; braking clears drift. Motion is illustrative: collision avoidance, damage, and automatic arrival stopping are not implemented. Refresh resets the demo. At real scale, impulse movement is easiest to see zoomed into SRS.

Warp navigation: destination changes and clearing are locked at warp; LRS system inspection remains available. Engagement requires charged coils, impulse off, and alignment within 0.05 degrees when a destination exists. Clear Destination permits free-course warp. A fixed arrival point outside the safety boundary caps the last movement step and automatically exits warp. Manual exit remains available. Both exit paths discharge coils to zero; recharging is mandatory.

Selected destination displays time at current speed, computed from remaining safe-arrival distance divided by actual warp or sublight velocity magnitude. Shows Stopped at zero speed and a dash without a destination. This is a constant-speed estimate, not a prediction that accounts for heading, future turns or braking. Outside-system header uses Deep Space.

### Planetary ring sections

Discovery data contract: each GTO may have zero or more ring sections, stored as child records with object ID, section name, innerRadiusKm, outerRadiusKm, and source reference. Radii are measured from planetary center of mass; require 0 < inner < outer, outside the body, and preserve gaps between bands. Render light-gray filled annuli at 30% opacity in System/SRS at true map scale, hidden below the planet dot size; LRS remains dot-only. Database migration is deferred to implementation.

Saturn preview includes the principal C, B and A bands with approximate rounded radii (km): C 74,660–91,980; B 91,980–117,510; A 122,340–136,780. Cassini Division remains unfilled. Fine ringlets and diffuse rings are omitted in this first visual.
Source: [NASA Saturnian Rings Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html) (indexed data; original currently redirects to maintenance).

Earth Orbital Station: static Sol-system station at 400 km above Earth, purple, visible in System/SRS only, selectable. Its diameter is 100 times the demo ship length; provisional ship length is 100 m (station diameter 10 km), pending actual hull dimensions. Source for ISS-like altitude: https://www.nasa.gov/reference/international-space-station/ .

Auto Dock final approach supersedes the earlier one-kilometer stop: align bow toward station and stop with bow docking port ten meters outside station hull. Ship center stand-off includes half demo ship length. Station then engages moorings/clamps; user connects umbilical.

Latest review: read-only speed gauge is linear against active-mode maximum speed, with5% ticks and25/50/75 labels, aligned with slider tracks and no text underneath. Attitude fill extends from center according to actual angular rate. Selected-object approach caps:100km25%,10km10%,5km2%,2km Auto Dock only. Automatic light braking and swept sublight collision checks apply; warp transit exception remains.

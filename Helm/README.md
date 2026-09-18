# Helm discovery preview

Earth surface settlements: the footer's Earth Settlements camera preset centers Earth for review. SRS and System views show eight two-pixel yellow dots on the physical rim below 20,000 km radius, with labels at 10,000 km and closer. Click a dot for distance and Mark I range/line-of-sight status. Names: Paris, Jerusalem, Moscow, Hong Kong, Tokyo, San Francisco, St. Louis, Port Canaveral. Bearings are equally spaced fixtures, not geographic coordinates. The shared requirements for future live maps are captured in the Transporter discovery notes.

Open index.html through a local static server. No build or dependencies required. index.html, styles.css and preview.js are standalone design references; assets/ is reserved for screen assets. Map graphics are canvas-drawn.

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

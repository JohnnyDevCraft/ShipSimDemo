# Life Support Control

The life support console (2026-10-29), on the Helm design. The system schematic fills the space between the side panels and the controls float over it. It does not draw the ship or track rooms, since every ship's layout differs: the cabin has one ambient temperature. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/life-support-layout.cjs` checks those sizes and `tests/life-support.cjs` the behaviour.

Files: `index.html`, `styles.css` and `lifesupport.js`, minified with `../Shared/console-ui.js` and `../Shared/habitability.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`; `../Shared/console.css` is the shared console look.

- **Schematic:** in the drawing style of Battery, Reactor and Docking Control. On the left, what feeds life support: the **station feed** over the umbilical (air, heat and power, violet) and **ship power** from the bus (cyan). In the middle, the **life support plant** with its state, effectiveness and four units (O₂ generator, CO₂ scrubber, thermal regulator, gravity generator), each with a lamp and a bar. On the right, what it supplies: the **cabin** (ambient temperature, oxygen, CO₂, CO and habitability, green air stream) and **gravity** (the g level, blue stream). Outside is the station bay when docked, or space.
- **Atmosphere (left):** oxygen, carbon dioxide and carbon monoxide, each with a meter, its danger limit marked, and its normal and danger values; habitability (habitable, degraded, dangerous, non-habitable); and the time left before the ship is non-habitable at the present rate, or "Air holding".
- **Systems (right):** the source (station, ship plant or nothing), the power drawn and where from, the ship plant (on, on and redundant, standby or off), its effectiveness (wearing down with damage), gravity (on or off, the g level and what powers the plating), the cabin temperature, the thermostat and the outside.
- **Advisory line:** non-habitable and why, life support off with no station feed and the time left, a plant too damaged to keep up, recovering air, gravity off, a cold cabin, or the station feeding us.
- **Bottom bar:** **Life Support** on and off (green on, red off, violet off while the station feeds us), **Gravity** on and off, **Thermostat** (16 to 26 °C) and **Diagnostics**.
- **NON-HABITABLE:** once the air can no longer support life, everyone aboard has died: a full-screen notice covers the console and names the cause. `../Shared/habitability.js` keeps this where every page on the origin can see it, and every console shows the notice too, at once if it is already open (each loads the script with `data-watch`; `tests/habitability.cjs` checks them all). **Restart demo** on this console's notice brings the ship back; the other consoles point here to restart.
- **Menu → Demo controls:** docked with the umbilical connected (standing in for Docking Control), damage to the plant, and the demo clock (×1, ×10, ×60).

## Rules

- Docked with the umbilical connected, the station feeds air, heat and power (twice the crew's need), and the ship's plant is redundant (on) or on standby (off), as on Power Distribution.
- With no station feed, the ship's plant must be on. With nothing supplying the air, each gas reaches its lethal level in ten minutes (Power Distribution's outage clock has oxygen exhausted at 10:00): oxygen falls from 21% to 10%, carbon dioxide rises from 0.4% to 8%, carbon monoxide from 2 to 800 ppm. Danger is oxygen below 16%, CO₂ above 3% or CO above 200 ppm; degraded is oxygen below 19.5%, CO₂ above 1% or CO above 35 ppm.
- An undamaged plant supplies 125% of the crew's need. Damage lowers its effectiveness; below 80% it falls behind and the air slowly fails (at 50%, non-habitable in 26 minutes 40 seconds from normal air). A supply above the need brings the air back to normal.
- The cabin loses heat to the outside (12 °C in five minutes to space, much less in a station bay) and the thermal regulator, at the plant's effectiveness, brings it back to the setpoint. A cabin at −20 °C is non-habitable.
- Gravity ramps to 1 g or to zero at 0.2 g a second.
- Power: the plant draws 2 PU and the gravity generator 3 PU, from the station while connected, otherwise from the ship bus.
- This page does not yet share docking or power with Docking Control or Power Distribution: the station feed is a demo stand-in.

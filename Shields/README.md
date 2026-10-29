# Shield System Control

The shield officer's console, rebuilt on the Helm design (2026-10-29). It replaces the Angular weapons-demo screen (`../Weapons/#/demo/ssc`); the shield model is the same. The shield envelope fills the window and the controls float over it. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/shield-layout.cjs` checks those sizes and `tests/shield-control.cjs` the behaviour.

Files: `index.html`, `styles.css`, `../Shared/console.css` (the shared console look) and `shields.js`, minified with `../Shared/console-ui.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`. Ships are drawn with Helm's top-down image, `../Helm/assets/terran-escort-top.png`. `scripts/build-weapons.cjs` no longer writes this page.

- **Envelope (the whole window):** our ship at the centre, to scale, inside the four facings (Forward, Starboard, Aft, Port). Each facing is a faint wedge with a bright arc: blue at 50% or more of its share left, yellow below 50%, red below 10%, a dashed red line when it is down; a dashed grey ring when the shields are not holding. Each facing's name and what it holds (left / allocated SEO) sit just outside its arc. Range rings mark distance in metres, and the view zooms to fit the envelope and every nearby ship. Hits ripple where they land.
- **Compass rose:** bearings relative to our bow around the edge of the map (000 forward, numbers every 30°). Enemies are red dots at their bearings, named with their range and bearing; a dot flashes white as it fires, with a trace to where the shot struck. A facing under fire gets a dotted red edge outside its arc.
- **Nearby ships:** drawn to scale with the same ship image, tinted blue and turned to their own headings, outlined green when protected and amber when exposed, with distance and status.
- **Emitter Output (left):** max and available SEO, the shield extension (20–500 m) on a slider, the envelope radius, total SEO left and module integrity.
- **Facings (right):** one allocation slider per facing; moving one shares the rest among the others so the total stays 100%. A table gives each facing's SEO, drain and what is left, with ◆ and a count for the enemies firing on it, and the recovery rate below.
- **Advisory line:** what the shields need: destroyed or under-integrity generator, shields down (urgent with enemies in range), a facing down, where to move allocation under fire, facings below 10% or 50%, the extension a nearby ship needs, or all holding.
- **Top bar:** shields up, facing down, shields down, offline or destroyed.
- **Bottom bar:** Raise/Lower Shields (a blocked Raise says why), Balance Facings (25% each), Coverage (each nearby ship: distance, hull, heading, facing and whether it is protected or how far to extend) and Diagnostics.
- **Menu → Demo controls:** add enemies (up to six) or clear them, let them fire on the facing they are over and circle the ship, and the fire interval; hit strength and a hit on each facing; recovery on or off, its interval and amount; max SEO, the SEO kept at 500 m, module integrity and the minimum to hold; add rescue ships (up to six, each at a random heading) or clear them; Reset Demo.

## Rules the stand-in follows

The rules are the Angular demo's:

- Available SEO falls linearly with extension: all of max SEO at 20 m, the "SEO kept at 500 m" share (40%) at 500 m. The envelope radius is half the hull length (120 m hull) plus the extension.
- Each facing gets its allocation's share of the available SEO. A hit drains its facing by the hit strength; what is left is the share less the drain. A hit on a facing that is down reaches the hull and adds no drain (hull damage is not simulated here).
- Recovery removes its amount of drain from every facing each interval (10 SEO every second), only while the shields hold.
- Shields hold when raised with module integrity above zero and at or above the minimum (20%). Raising needs that integrity; integrity falling below it takes raised shields offline.
- A nearby ship is protected when all four corners of its hull, at its own heading, are inside the envelope under a facing that still holds.
- Enemies sit kilometres away; only their bearing matters to the shields. Each fires every interval (4 s) at the hit strength on the facing over its bearing, and they drift round the ship at 1.5° a second, alternating direction.
- The demo starts with shields up, facings balanced at 25%, no drain, one rescue ship (180 m to starboard, heading 030°) and no enemies; Reset Demo returns to that.

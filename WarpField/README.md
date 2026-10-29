# Warp Field Control

A new console (2026-10-29) on the console layout: there was no earlier screen. The warp field fills the window and the controls float over it. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/warp-field-layout.cjs` checks those sizes and `tests/warp-field.cjs` the behaviour. `discovery.md` sets out the field rule and what is still to be decided.

Files: `index.html`, `styles.css`, `../Shared/console.css` (the shared console look) and `warpfield.js`, minified with `../Shared/console-ui.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`. Ships are drawn with Helm's top-down image, `../Helm/assets/terran-escort-top.png`.

- **Field map (the whole window):** from above and to scale: our ship; the normal field (cyan dashes), what the drive makes without stretching; the largest field it can make (amber dots, "MAX +500 M"); the field as set, a glowing bubble whose edge shimmers; and, when it differs, the field that would fit round the ships (green dashes). Ships are drawn with the ship image at their own headings: green inside the field, amber when the field's edge cuts them, grey outside, each with its distance and what it needs ("EXTEND TO 306 M"). At warp, streaks slide past outside the bubble and only the ships we carry stay on the map. Range rings mark metres; the view zooms to fit.
- **Warp Field (left):** radius and extension, the extension on a slider (0 to the most the drive can add, with a green mark at the extension that fits round the ships), the normal field, the stretch and the field load (how many times the power each warp factor takes).
- **Warp Drive (right):** read only; this console does not set the warp. The **Warp Limit** gauge runs from 0 to the drive's max warp: filled blue up to the most warp this field allows, hatched amber above it for what the field takes away ("of 6 · field takes 3.1"), with a white mark at the Helm's warp factor. Beside it the core load, at the Helm's warp: blue for what that warp takes at the normal field and amber for the extra the stretched field adds, with the supply marked in red when it is below the drive's max power. Below: the Helm's warp (and "held to the limit" when the field holds it down), its speed in multiples of light and the supply.
- **Advisory line:** what the field needs: a ship cut by its edge (extend to, or pull in to), a ship outside that it could take, not enough supply to reach warp 1, or the field, what it carries and the warp it allows; at warp, what it carries and the core load.
- **Top bar:** standby, warp factor, field cuts ship or no warp.
- **Bottom bar:** Fit to Ships, Normal Field, Ships (each ship: distance, hull, heading, the field it needs and its state) and Diagnostics (every reading and the rule). Going to warp is the Helm's job, not this console's.
- **Menu → Demo controls:** the drive (Courier, Mark I, Mark II, or its max power, max warp and our hull length by hand), the supply to the drive, stand-ins for the Helm (its warp factor, and Engage Warp / Drop to Impulse, refused while a ship is cut by the field), the universal stretch per PU, add a ship nearby (random place and heading) or clear them, and reset.

## Rules the demo follows (provisional)

The same rule for every warp drive; only the drive's max power, max warp and hull length change:

- **Normal field:** half the hull + 20 m (80 m for the 120 m Mark I ship).
- **Most extra field:** 3.57 m for each PU of max power (500 m for the 140 PU Mark I, 714 m for the 200 PU Mark II, 286 m for the 80 PU Courier).
- **Stretch:** the extension as a share of the most extra field, 0 to 1.
- **Power:** max power × warp ÷ max warp × (1 + (max warp − 1) × stretch²). At the normal field this is the straight-line law the Helm and Power Distribution use today.
- **Warp limit:** max warp × (supply ÷ max power, at most 1) ÷ (1 + (max warp − 1) × stretch²). The Helm's warp factor is held to it, so stretching the field brings the Helm's warp down with it.
- **The limit:** at full stretch, warp 1 takes all of the drive's max power, so that is the largest field it can make. With less supply, a field near the limit cannot reach warp 1 at all.
- **Ships:** a ship goes to warp with us only when all four corners of its hull, at its heading, are inside the field. One cut by the field's edge blocks the jump; ships outside are left behind when we drop out of warp. At warp the field cannot shrink through a ship it carries.
- **Fit to Ships:** the smallest field (plus 5 m) round as many ships as the drive can reach, without cutting any it leaves out.
- The demo starts with the Mark I, full supply, the Helm at warp 2, the field at its normal size, the freighter Meridian alongside under tow (240 m) and the shuttle Kestrel adrift (140 m).

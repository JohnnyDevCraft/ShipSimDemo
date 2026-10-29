# Warp field: the rule, and what is still to decide

## The rule (one for every warp drive)

Each warp drive has a max power (PU), a max warp, and the hull it is fitted to. Nothing else is needed:

| Quantity | Formula | Mark I (140 PU, warp 6, 120 m hull) |
| --- | --- | --- |
| Normal field R₀ | hull ÷ 2 + 20 m | 80 m |
| Most extra field E | 3.57 m × max power | 500 m |
| Stretch s | extension ÷ E (0 to 1) | — |
| Field load L | 1 + (max warp − 1) × s² | 1 to 6 |
| Power at warp w | max power × w ÷ max warp × L | warp 6 unstretched: 140 PU |
| Max warp now | max warp × min(1, supply ÷ max power) ÷ L | 6 → 2.67 at half stretch → 1 at full |

Why this shape:

- **At the normal field (s = 0)** it is the straight-line law the Helm, Power Distribution and the simulator already use (power = max power × warp ÷ max warp), so nothing that exists changes.
- **Bigger and faster cost more:** power rises with the warp factor and with the square of the stretch, roughly as the field's area grows.
- **The power limits the size:** at full stretch even warp 1 needs all of the drive's max power, so E is the largest field the drive can make, and it comes from the drive's power: a bigger engine stretches further by the same rule (280 PU → 1,000 m).
- **Stretching lowers the top speed:** max warp falls by the field load, and the warp factor comes down with it.

Example, Mark I at half stretch (+250 m, a 330 m field): load 2.25, max warp 2.67, and warp 2 takes 105 PU instead of 47 PU.

## To decide

1. **The constants.** 3.57 m per PU (500 m for the Mark I) and the 20 m margin are starting points. Should the most extra field instead be a share of the normal field (big hulls stretch further), or a flat 500 m for every drive?
2. **The curve.** Stretch is squared (area-like). Cubed would make small stretches cheaper and big ones dearer; linear the reverse.
3. **Field shape.** The demo's field is a circle. Fields could be ellipses, longer fore and aft, which would carry a ship astern more cheaply than one abeam.
4. **Charging.** The Helm charges the coils before engaging (20% of max power while charging, in Power Distribution). Should a stretched field charge more slowly, or draw more while charging (× the field load)?
5. **Changing the field at warp.** The demo allows it (never through a carried ship), lowering the warp at once. Real drives might only stretch at rest, or need a recharge.
6. **Mass.** Carried ships could add load by their mass as well as the field's size.
7. **Who controls what.** The Helm sets the warp factor and goes to warp; this console only sets the field and shows the limit it puts on the drive. The Helm's warp slider should show the same limit, and its Engage should refuse while a ship is cut by the field.
8. **Ships cut by the field.** The demo blocks the jump. Alternatives: the cut ship is damaged, or pushed out of the field as it forms.
9. **Tractor Beam Control.** Its warp field radius (500 m from our centre in that demo) should come from this console's field, so "warp ready" there means "inside the field" here.
10. **The live console.** The server should own the rule and the field (so every console agrees), with this page sending only the requested extension; the drive's catalog entry carries max power and max warp, and the stretch constant lives in one shared place.

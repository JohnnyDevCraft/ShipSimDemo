# View Screen discovery demo

Open http://127.0.0.1:18083/ViewScreen/ using the existing Templates preview server. This is a standalone design using sample data, with no live simulation API calls.

Use View type, SRS range and LRS range in this preview footer. Choices persist locally after reload and are independent of Communications. SRS/LRS single modes pair a ship-centered radar with tactical/navigation details. Dual pairs LRS and SRS; the tactical name stays below SRS. The five bottom telemetry boxes remain across every mode.

Footer controls simulate tactical selection, reactor temperature and docking connections for design review. Tactical selection comes from the tactical officer in the eventual implementation. The center is always our ship; local radar range is capped by the communications choice, not local scrolling. Labels are decluttered at broad scales. Body/star positions and telemetry are illustrative, not a production universe export. Planet settlements use the established two-pixel/range rules.

Temperature caution at50% and critical at90% of the sample530K threshold are provisional visual zones. Registry and navigation coordinates are sample values. Production integration, actual tactical/navigation selection, telemetry and shared server-owned configuration require a later approved implementation.

Both scanner modes use a static shared bearing scale: one-degree outer-rim ticks, longer ten-degree ticks and center spokes every thirty degrees. No rotating sweep is displayed.

LRS shows one active navigation destination, with separate galactic/system coordinate lines and destination-specific details. The station sample includes population aboard, operator, and docking/refueling/power/cargo/medical/repair services. Population and services are illustrative. Planet destinations will show planet classification and population when supported in production.

Ship contacts use smaller heading-oriented chevrons. Meridian starts4,200km east and2,100km north of our ship, moving at128degrees with an adjustable demo speed(default80km/s). Reset ship motion restores that start without changing view settings. Range/bearing details update as it moves; contacts leaving the radius disappear naturally. Animation pauses while the tab is inactive rather than jumping forward.

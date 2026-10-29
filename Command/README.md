# Command Control

The captain's pocket console (2026-10-29), laid out for a phone held upright, iPhone or Android. It shows the ship's damage and where the DOTs are, and it gives the controls for the bridge's main view screen. It does not show the view screen itself. The console keeps the bridge look (the console colours, panels, buttons and the Tactical Officer's camera stick) in a phone layout: a top bar, a status strip, one tab at a time and a tab bar at the bottom, inside the phone's safe areas. On a tablet or desktop it stays phone-sized in the middle of the window. `tests/command-layout.cjs` checks phones from 360×640 to 430×932 (and sideways, a tablet and a desktop) with touch in Chromium and WebKit, and `tests/command-control.cjs` checks the behaviour.

Files: `index.html`, `styles.css` and `command.js`, minified from `demo-app/static-src/`. It uses `../Shared/console.css` and `../Shared/console-ui.js` (the console look and helpers), `../Shared/view-screen-settings.js` (the view screen's settings, shared with Communications, Tactical Officer Control and the View Screen), `../TacticalOfficer/camera.js` (the camera stick), `../Shared/dot-bay-report.js` (DOT Bay Control's report) and `../Shared/habitability.js` (the NON-HABITABLE notice, as on every console).

- **Status strip (always on screen):** how many components are damaged, how many DOTs are out of the bay, and the worst component, coloured by the worst damage. A light on the right is green while DOT Bay Control is reporting and amber for the stand-in. A tap opens the Status tab.
- **Status tab:** the four DOTs (state, where each one is or is going, battery) and the ship's twelve components as DOT Bay Control lists them: damaged first, integrity, the DOTs on each, and the repair time left.
- **View tab:** the main view screen's camera.
  - The stick: left and right swing the camera round the ship (all 360°), up and down zoom in and out (1× to 20×). The further it is pushed, the faster it turns or zooms; let go and it springs back and the camera holds.
  - The camera bearing from the bow, the zoom, and a small dial with the camera's field of view.
  - PORT, FWD, AFT and STBD jump straight to those views.
  - **Scanners:** SRS, LRS, DUAL (both) or NONE (the forward scope alone) on the view screen.
- **Labels tab:** which names the view screen shows (stars, planets, anomalies, star bases, ships, settlements), one at a time or all on or off. The objects stay on screen either way.
- **Menu:** demo controls (damage the stand-in ship at random, repair it, reset it) and links to DOT Bay Control and the View Screen.

## Rules

- **Ship status:** DOT Bay Control writes its components and DOTs twice a second (`xmps-demo-dot-bay`). A report older than 5 seconds means DOT Bay Control is closed, and a stand-in ship shows: DOT Bay Control's starting damage (warp drive 40%, shield generator 65%, phaser array 20%, sensors 80%) with DOT 1 repairing the phaser array, DOT 2 beaming to the warp drive, DOT 3 charging for the warp drive and DOT 4 ready. The stand-in does not change on its own.
- **View screen:** every change is written to the shared view screen settings (`xmps-demo-view-screen`), which an open View Screen follows at once. A change made on Communications or Tactical Officer Control shows here too. The camera stick turns at up to 90°/s and zooms 1.2 doublings a second at full push, as on Tactical Officer Control.
- **Touch:** the stick takes one finger and ignores page scrolling. Page pinch and double-tap zoom are off, and every button is at least 44 px.

## Still to decide

1. **Reaching the bridge.** The demo shares state through the browser's storage, so the phone and the View Screen must be the same browser. The live console needs the server to carry the view screen settings and the DOT bay's report to the captain's phone.
2. **Who may move the view screen.** The captain, the tactical officer and the communications officer can all change it. Should the captain's change win or lock the others out for a time?
3. **More status.** Hull and shields, the reactor, the readiness condition and the tactical target would fit as more rows on the Status tab or a fourth tab.
4. **The scanners' ranges and the objects filter** are set only on Communications. They could be added to the View and Labels tabs.
5. **Ordering DOTs.** The captain can see the DOTs but not assign or recall them. Should the captain be able to set repair priorities from here?
6. **Haptics.** Android can buzz on a view jump or at the zoom limits. iOS Safari has no vibration API.
7. **Installing it.** The page can be added to the home screen. A web app manifest and icons would make it open full screen like an app.

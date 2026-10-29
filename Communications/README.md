# Communications Control

The communications officer's console, rebuilt on the Helm design (2026-10-29). It replaces the three-column preview (`preview.js`, `map.js`, `conversations.js`); the rules are the same. The signal map fills the window and every control floats over it. The page scales as one piece from an iPad in landscape (the smallest size) to 4K; it is not laid out for portrait. `tests/communications-layout.cjs` checks those sizes and `tests/communications.cjs` the behaviour.

Files: `index.html`, `styles.css`, `gto-data.js` (the chart: stars, planets, moons and stations) and `comms.js`, minified with `../Shared/console-ui.js` from `demo-app/static-src/` by `node scripts/build-static.cjs`; `../Shared/console.css` is the shared console look. `view-screen-discovery.md` describes the view screen settings.

- **Signal map (the whole window):** the chart, every detected transmission (red points; a selected one pulses, and a point-to-point link is drawn between its ends) and our ship (green), on a grid fixed to the screen with range circles and a galactic compass rose, as on Navigation Control; 000 points to the galactic centre, up the map. Drag to pan, pinch or scroll to zoom, tap to select, double-tap to centre. The line above the bottom bar describes the selection: galactic and system bearing and distance, and its distance from us.
- **Detected transmissions (left):** All, Subspace or RF. Each card gives the medium, type, open or encrypted, the origin, system, frequency, destination (point to point), origin coordinates and when it was heard. Tap one to select it (again to clear). Below: passive monitoring and the RF detection range.
- **Transmission (right):** the selected transmission's medium, name, received signal trace, type, channel, origin, destination or system, and the received content (hidden when encrypted), with Contact Origin.
- **Map range (right):** 100 km to 30 LY on a vertical slider.
- **Bottom bar:**
  - **Frequencies:** the standard frequencies as an overlay: Subspace or RF, a search box typed on the console keyboard, and one card per frequency; ships on the map add their advertised return channels. Tap one to open a communication on it.
  - **Communications:** the active communications and, for the chosen one, its setup (recipient; unicast, multicast or point to point; subspace or RF; the channel on the keypad; encryption) or, once opened, the chat with a message composer. New and End. A badge counts the active communications.
    - **Keyboard or Voice** (in the overlay's header) chooses how the recipient and messages are entered. Keyboard opens the console keyboard; Voice opens a microphone panel in its place and the browser's speech recognition writes what is said into the field, showing words as they are heard; Clear and Done. The choice is remembered on the device. Voice needs a browser with speech recognition (Chrome, Edge or Safari) and microphone permission; otherwise the panel says so and points to the keyboard. Chrome and Edge send the audio to their speech service, so they need a network connection.
  - **Contact:** our subspace return channel and whether we broadcast it. The top bar shows BROADCAST and the channel, or LISTENING.
  - **View Screen:** view type (SRS, LRS or dual), SRS and LRS ranges, and which labels and objects the bridge view screen shows. Kept for the session.
  - **30 LY View** and **Our Ship** move the map.
- **Menu → Demo controls:** detect a sample transmission and set the RF detection range. Reset demo restores the seven sample transmissions and clears the communications.

## Rules (from the preview)

- A detection is listed for five minutes after it is heard, while one of its ends is on the map and, for RF, while it is within the RF detection range (100,000,000 km by default). Subspace has no range limit.
- Unicast uses channel 0. Multicast and point to point need a channel other than 0. Only point to point can be encrypted.
- Contact Origin opens a point-to-point communication on the transmission's advertised return channel (or its frequency), with the received content as the first message. A communication already open on the same channel and medium is reused.
- Opening a communication starts the demo's scripted exchange with the recipient (Terran Space Command when none is given). Messages we send are added to the chat; on a subspace unicast they carry our return channel.
- Standard frequencies for a system are listed while that system is on the map; general distress and fleet operations always are.
- A transmission's ends are where its detection says: an origin or destination that is our ship or a named station, planet or star is drawn exactly there; a ship the chart does not hold is placed near its system's station, clear of the star. A destination with no known place ("Unresolved") is not drawn. (The preview placed origins beside the station and sent every point-to-point link to the next system over, whatever the destination.)

Changes from the preview: Send now adds the message to the chat (the preview's final script left it doing nothing), the dictation button, which did nothing, is replaced by working voice entry, and a frequency tapped in the overlay opens a multicast communication on its channel (the preview opened unicast, which forced the channel to 0).

# Desktop (Tauri)

Native window. Talks to the orchestrator at http://127.0.0.1:8787. Not a browser app.

The shell is a Grok-like 3-pane UI: bots on the left (personas as teammates), a centered near-black chat in the middle, and a live Computer pane on the right for the per-persona Docker VM plus sandbox exec. No cloud, no Electron, no Google Fonts.

Start the API first, then run the desktop package script `dev` (Tauri). Persona is chosen per thread; changing it keeps memory. The `build` script produces a packaged installer.

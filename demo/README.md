# Whiteboard E-Prescription Demo

A standalone demo: a doctor writes a prescription by hand on a digital whiteboard. Handwritten
medicine names are recognized live and matched against a mock drug list; confirmed medicines get
structured dosage details and build up into a printable e-prescription.

This is a demo only — no backend, no persistence beyond the browser session.

## Setup

1. `npm install`
2. Get a free MyScript developer account and application/HMAC key pair:
   https://developer.myscript.com/getting-started/web
3. Copy `.env.example` to `.env` and fill in your keys:
   ```
   VITE_MYSCRIPT_APPLICATION_KEY=your-application-key
   VITE_MYSCRIPT_HMAC_KEY=your-hmac-key
   ```
4. `npm run dev`

Without keys, the whiteboard still renders and can be drawn on, but handwriting recognition (and
therefore the medicine suggestion popups) won't fire — a banner in the app explains this.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm test` — run the unit/component test suite

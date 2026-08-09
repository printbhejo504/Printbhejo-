# PrintBhejo

PrintBhejo is a temporary browser-to-browser file transfer and printing app.

## Architecture

- WebRTC DataChannel: actual file transfer
- IndexedDB: temporary received-file storage in the receiver browser
- Supabase Realtime: PIN/session + WebRTC signaling
- No file blobs are uploaded to Supabase Storage by this starter
- Files expire locally after 10 minutes
- PIN/session expires after 10 minutes

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Add your Supabase URL and anon key to `.env`.

## Supabase setup

Create the SQL in `supabase/schema.sql`.

The app expects Supabase Realtime to be enabled for the `webrtc_signals` table.

## Important

For production networks, configure a TURN server in addition to STUN. WebRTC can require TURN when direct connectivity is blocked by NAT/firewalls.

## Important Links
The app includes official links and logo/favicons for MPOnline, RGPV, Barkatullah University, MPBSE, MPESB, MPPSC, SSC, MP e-Pravesh, MP Scholarship Portal, MPTAAS, Samagra, MP e-District, DigiLocker, NSP, NTA and UPSC.

## Cloudflare Pages
Build command: `npm run build`
Output directory: `dist`
Set these browser-safe environment variables in Cloudflare: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or the backward-compatible `VITE_SUPABASE_ANON_KEY`). Never add a Supabase service-role/secret key.

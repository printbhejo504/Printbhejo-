# PrintBhejo — Supabase setup

## 1. Create a Supabase project
Create a project in Supabase and open **SQL Editor**.

## 2. Run the database schema
Open `supabase/schema.sql`, paste the complete file into SQL Editor, and run it.

The schema creates:
- `public.transfer_sessions` — temporary 10-minute PIN sessions
- `public.webrtc_signals` — WebRTC offer/answer/ICE signaling only
- RLS policies for anonymous browser use
- Supabase Realtime publication for `webrtc_signals`

No file bytes are uploaded to Supabase. Files travel browser-to-browser over WebRTC and are kept temporarily in the receiver browser's IndexedDB.

## 3. Configure Vite environment variables
Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
# Optional backward-compatible variable:
VITE_SUPABASE_ANON_KEY=
VITE_STUN_SERVER=stun:stun.l.google.com:19302
VITE_TURN_SERVER=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

Use only the browser-safe **publishable/anon key**. Never put a `service_role`/secret key in Cloudflare or this repository.

## 4. Install and build

```bash
npm install
npm run build
```

For local development:

```bash
npm run dev
```

## 5. Production requirements
- Deploy the Vite `dist/` output to your host.
- Use HTTPS. QR camera scanning requires a secure context (`https://` or localhost).
- If users are behind restrictive NAT/firewalls, configure a TURN server in the `VITE_TURN_*` variables.

## Transfer flow
1. Receiver opens **Receive · Show PIN**.
2. A PIN is generated automatically and shown with a QR code.
3. Sender enters the PIN or scans the QR code.
4. Supabase Realtime carries WebRTC signaling.
5. WebRTC DataChannel transfers the actual files peer-to-peer.
6. Received files remain in browser storage for 10 minutes and are then deleted.

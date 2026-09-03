Final transfer fixes are in App.jsx and webrtc.js.

App:
- Uses the actual session PIN returned by createSession, so logged-in permanent QR/PIN matches the database session.
- After file selection, the picker is replaced by Send File.
- Clears selection after a successful send.

WebRTC:
- Keeps the same data channel open for repeated transfers.
- Serializes sends and waits for receiver acknowledgement.
- Allows a new send after a failed transfer attempt.

# Cloudflare Tunnel

Exposes the ClipSync server for phone/tablet access without opening a port on
your router.

Run `cloudflared` wherever the server runs. For the Synology deployment that is
the NAS, not the Windows desktop — see `DEPLOY-SYNOLOGY.md`.

1. Install `cloudflared` (DSM: Container Manager, image `cloudflare/cloudflared`;
   or on the desktop if you are running the server there).
2. Authenticate: `cloudflared tunnel login`
3. Create the tunnel and route DNS:
   `cloudflared tunnel create clipsync`
   `cloudflared tunnel route dns clipsync clipsync.yourdomain.com`
4. Point it at the server's **host** port — `http://<nas-ip>:5055` by default,
   or `http://localhost:5000` if you are running the server directly on a
   desktop rather than in Docker.

The server serves the PWA and the API from the same origin, so a single
hostname covers both. Put Cloudflare Access in front of it — the app's own auth
is a JWT with a 7-day expiry and nothing else.

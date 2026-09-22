# Deploying ClipSync on a Synology NAS

Written against a **DS923+** (AMD Ryzen R1600, x86_64) running **DSM 7.2** with
**Container Manager**. Any x86_64 Synology with Container Manager works the same
way; ARM-based models do not, because the `node:20-alpine` and `postgres:16`
images used here are amd64.

## Why the host port is 5055, not 5000

DSM serves its own web interface on **5000 (HTTP)** and **5001 (HTTPS)**.
Publishing the server on host port 5000 collides with DSM itself. The compose
file binds `5055:5000` by default — container-internal stays 5000, only the
host side moves. Change it with `CLIPSYNC_PORT` in `infra/.env`.

Anything that talks to the server needs the new port: the Cloudflare Tunnel
target, and `base :=` in `desktop/clipsync-hotkeys.ahk`.

## Setup

**1. Put the repo on the NAS.** Shared folder `docker`, then:

```
/volume1/docker/clipsync-src/          <- the cloned repo
/volume1/docker/clipsync-src/infra/    <- the Container Manager project path
```

The compose file builds with `context: ..`, so the *whole repo* has to be
present — pointing Container Manager at a lone `infra/` folder will fail.

**2. Create `infra/.env`** from `infra/.env.example`:

```bash
cp infra/.env.example infra/.env
openssl rand -hex 32          # paste into JWT_SECRET
openssl rand -hex 16          # paste into POSTGRES_PASSWORD
```

Both are required. Compose aborts with a named error if either is missing —
that is intentional. Keep `POSTGRES_PASSWORD` alphanumeric: it gets
interpolated into a `postgres://` URL, and `@ : / ? #` will corrupt it.

**3. Container Manager → Project → Create.** Path
`/volume1/docker/clipsync-src/infra`, source `docker-compose.yml`. Build and
start.

With 32 GB of RAM, building on the NAS is fine — the client build peaks around
1–2 GB. On a 4 GB unit you would build elsewhere and push the image instead.

**4. Open `http://<nas-ip>:5055`.** Go to Settings, register an account, and
leave the API base URL blank — the server serves the PWA and the API from the
same origin, so relative paths just work.

## What the stack does

| | |
|---|---|
| `postgres` | PostgreSQL 16. Not published to the LAN — reachable only on the compose network. Schema applied from `schema.sql` on first init. |
| `server` | Express API **and** the built React PWA in one image, on one port. |

Both use `restart: unless-stopped`, so they survive NAS reboots and DSM updates.

### Database schema

There is no `drizzle/` migrations folder in this repo, so `migrate.ts` has
nothing to apply and nothing runs `db:push`. The compose file mounts
`schema.sql` into `/docker-entrypoint-initdb.d/` instead, which Postgres
applies automatically **on first init only**.

If you change `server/src/db/schema.ts` later, update `schema.sql` to match or
generate real migrations — the mount will not re-run against an existing volume.

### Using your existing Postgres instead

If you would rather point at the Postgres already on this NAS: delete the
`postgres` service and the `depends_on` block, set `DATABASE_URL` to that
instance, and apply `schema.sql` to a new `clipsync` database by hand. With
32 GB there is no memory reason to — a separate container keeps ClipSync's
backup cycle and roles isolated from your other data.

## Remote access

Point a Cloudflare Tunnel at `http://<nas-ip>:5055`. See `cloudflare-tunnel.md`.

## Known gaps — not fixed by this deployment

- **Hotkeys do not work.** `desktop/clipsync-hotkeys.ahk` declares
  `#Requires AutoHotkey v2.0` but its bundled JSON helpers are AutoHotkey v1
  code (`ByRef` parameters, backslash escapes). The script will not load. The
  NAS cannot host this either way — global hotkeys and clipboard capture are
  Windows-side. When it is fixed, it needs `base :=` set to the NAS address and
  `apiToken` filled in, since every `/api` route requires auth.
- **Images and files are write-only.** Blobs persist to `/data/blobs`, but
  `blobUrl` is stored as a filesystem path and no route serves it back.
  `BLOB_STORAGE_URL` is intentionally left unset — setting it would produce
  URLs that 404.
- **No real-time sync.** The client does not poll or hold a socket; the
  clipboard list refreshes on navigation and mutation only.
- **A database outage reports as HTTP 400**, not 500, and echoes the internal
  DB host and port in the error body. If you see
  `{"error":"connect ECONNREFUSED ..."}` from an API call, that is Postgres,
  not your request.

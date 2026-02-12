# ClipSync — Clipboard Sync Platform

A self-hosted clipboard sync and automation hub with a rules engine, AI prediction, programmable hotkeys, and cross-device access. Runs on Windows desktop with PostgreSQL on a NAS, mobile access via Cloudflare Tunnel / PWA.

---

## 1. Repo Layout

```
clipboard-sync-platform/
  server/                   # Express.js API + rules engine + AI
    src/
      index.ts              # Server entry
      routes/
        auth.ts
        clips.ts
        rules.ts
        folders.ts
        ai.ts
        predictions.ts
      engine/
        rule-engine.ts      # Rule matching + action execution
        predictor.ts        # AI clipboard prediction engine
      db/
        schema.ts           # Drizzle ORM schema (all tables)
        migrate.ts          # Migration runner
      services/
        ai-service.ts       # LLM integration (OpenAI / Anthropic)
        blob-storage.ts     # File/image storage
      middleware/
        auth.ts             # JWT / API key auth
    package.json
    tsconfig.json
    drizzle.config.ts
  client/                   # React PWA frontend
    src/
      pages/
        clipboard.tsx       # Main clipboard stream
        rules.tsx           # Rules management
        folders.tsx         # Folder/collection view
        predictions.tsx     # AI prediction dashboard + accuracy game
        settings.tsx        # Configuration
      components/
        ui/                 # shadcn/ui components
        clip-card.tsx
        ai-chat.tsx
        hotkey-indicator.tsx
        prediction-banner.tsx
      hooks/
      lib/
    index.html
    package.json
    vite.config.ts
  desktop/                  # AutoHotKey integration for system hotkeys
    clipsync-hotkeys.ahk    # Ctrl+Alt+1-12 hotkey bindings
    tray-icon.ahk           # System tray with status
    README.md               # Setup instructions
  infra/
    docker-compose.yml      # For NAS deployment
    Dockerfile.server
    Dockerfile.client
    schema.sql              # Raw SQL backup of schema
    cloudflare-tunnel.md    # Tunnel setup guide
  .env.example
```

## 2. Tech Stack

| Layer | Tech |
|-------|------|
| **Backend** | Node.js 20 + Express.js + TypeScript |
| **Database** | PostgreSQL 16 (remote, on NAS) |
| **ORM** | Drizzle ORM + drizzle-kit |
| **Frontend** | React 19 + TypeScript + Vite |
| **UI** | shadcn/ui + TailwindCSS v4 + Framer Motion |
| **AI** | OpenAI API (gpt-4o / gpt-4o-mini) |
| **Auth** | JWT tokens (simple API key option for v1) |
| **Desktop Hotkeys** | AutoHotKey v2 scripts |
| **Mobile** | PWA (installable) + Cloudflare Tunnel |

## 3. Database Schema

All tables in PostgreSQL. Use Drizzle ORM with `drizzle-kit push` for migrations.

### 3.1 `users`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| email | text | unique, required |
| hashed_password | text | bcrypt hash |
| api_key | text | optional, for programmatic access |
| created_at | timestamp | default now() |

### 3.2 `devices`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| name | text | e.g. "Desktop", "Phone" |
| platform | text | windows, android, web |

### 3.3 `clips`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| device_id | uuid | FK → devices, nullable (system/AI-created) |
| content_type | text | text/plain, image/png, application/pdf, mixed |
| text_content | text | nullable, the actual text |
| blob_url | text | nullable, path/URL for files/images |
| tags | jsonb | array of strings or key-value map |
| folder_id | uuid | FK → folders, nullable |
| is_pinned | boolean | default false |
| is_starred | boolean | default false |
| is_deleted | boolean | default false (soft delete / recycle bin) |
| hotkey_slot | integer | nullable, 1-12 for quick-access slots |
| source | text | 'manual', 'clipboard_monitor', 'ai_generated', 'prediction' |
| created_at | timestamp | default now() |
| updated_at | timestamp | |

### 3.4 `rules`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| name | text | human-readable name |
| match_type | text | 'mime', 'regex', 'contains', 'starts_with' |
| pattern | text | the match pattern |
| action | text | 'replace', 'route_folder', 'tag', 'webhook', 'ai_call' |
| params | jsonb | action-specific config |
| priority | integer | lower = runs first |
| enabled | boolean | default true |

### 3.5 `folders`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| name | text | display name |
| path_template | text | e.g. "Images/{YYYY}/{MM}/{DD}" |

### 3.6 `predictions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| predicted_content | text | what the AI predicted |
| actual_content | text | nullable, what was actually copied |
| confidence | real | 0.0-1.0 |
| was_correct | boolean | nullable, null = pending |
| context | jsonb | recent clips, active window, time of day, etc. |
| created_at | timestamp | |

### 3.7 `prediction_stats`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| window_size | integer | e.g. last 100 predictions |
| accuracy | real | 0.0-1.0 |
| total_predictions | integer | |
| correct_predictions | integer | |
| updated_at | timestamp | |

### 3.8 `ai_conversations`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| clip_id | uuid | FK → clips, nullable |
| role | text | 'user', 'assistant', 'system' |
| content | text | message content |
| workflow | text | nullable: 'summarize', 'improve', 'tags', 'code', 'email', 'ideas' |
| created_at | timestamp | |

## 4. API Endpoints

### 4.1 Auth
```
POST /api/auth/register    { email, password } → { user, token }
POST /api/auth/login       { email, password } → { token }
GET  /api/me               → { user, devices }
```

### 4.2 Clips
```
POST /api/clips            Create a clip (runs rule engine)
  Body: { content_type, text_content?, data_url?, tags?, device_id?, hotkey_slot? }
  Response: final stored clip (after rule engine modifications)

GET  /api/clips             List clips (paginated)
  Query: ?limit=50&before=<cursor>&folder=<id>&tag=<tag>&search=<text>&type=<content_type>

GET  /api/clips/:id         Single clip
PUT  /api/clips/:id         Update clip (pin, star, retag, move folder, assign hotkey)
DELETE /api/clips/:id       Soft-delete (move to recycle bin)

POST /api/clips/:id/copy    Mark a clip as "copied to device clipboard" (for prediction tracking)

GET  /api/clips/hotkeys     Get clips assigned to hotkey slots 1-12
  Response: { slots: { 1: clip, 2: clip, ... } }

POST /api/clips/hotkeys     Assign a clip to a hotkey slot
  Body: { clip_id, slot: 1-12 }
```

### 4.3 Rules
```
GET  /api/rules             List all rules for current user
POST /api/rules             Create rule
PUT  /api/rules/:id         Update rule
DELETE /api/rules/:id       Delete rule
POST /api/rules/test        Test a rule against sample content
  Body: { rule: {...}, test_content: "..." }
  Response: { matched: bool, result: "..." }
```

### 4.4 Folders
```
GET  /api/folders           List folders
POST /api/folders           Create folder
PUT  /api/folders/:id       Update folder
DELETE /api/folders/:id     Delete folder
GET  /api/folders/:id/clips Clips in a folder
```

### 4.5 AI
```
POST /api/ai/chat           General AI chat
  Body: { message, clip_id?, conversation_id? }

POST /api/ai/summarize      Summarize a clip → creates new clip tagged "summary"
  Body: { clip_id }

POST /api/ai/classify       Auto-tag a clip
  Body: { clip_id }

POST /api/ai/improve        Improve writing
  Body: { clip_id }

POST /api/ai/workflow       Run any slash command workflow
  Body: { clip_id, workflow: "summarize"|"improve"|"tags"|"code"|"email"|"ideas" }
```

### 4.6 Predictions
```
GET  /api/predictions/current    Get current AI prediction (what it thinks you'll copy next)
  Response: { prediction, confidence, context_used }

POST /api/predictions/resolve    Report what was actually copied
  Body: { actual_content }
  Server compares to latest prediction, scores it, updates stats

GET  /api/predictions/stats      Accuracy dashboard data
  Response: { accuracy, total, correct, recent_predictions[], streak }

POST /api/predictions/feedback   Manual feedback on a prediction
  Body: { prediction_id, was_helpful: bool }
```

## 5. Rule Engine

Runs on every `POST /api/clips` after parsing, before final storage.

### 5.1 Evaluation Order
1. Load all rules for user where `enabled = true`, sorted by `priority` ASC.
2. For each rule, check `match_type` against the clip:
   - `regex` → test against `text_content`
   - `mime` → match `content_type` (support wildcards like `image/*`)
   - `contains` → substring match on `text_content`
   - `starts_with` → prefix match on `text_content`
3. If matched, apply `action` with `params`.

### 5.2 Actions
| Action | Behavior |
|--------|----------|
| `replace` | Find/replace on `text_content` using `params.find` and `params.replacement` |
| `route_folder` | Compute folder path from `params.template` (supports `{YYYY}`, `{MM}`, `{DD}`, `{device}`), assign clip to matching folder |
| `tag` | Append `params.tags` (string array) to clip's tags |
| `webhook` | POST clip JSON to `params.url` (fire-and-forget) |
| `ai_call` | Queue AI processing: `params.workflow` (summarize, classify, etc.) |

### 5.3 Example Rules
```json
{
  "name": "Fix Marius URLs",
  "match_type": "regex",
  "pattern": "http://marius\\.hosting\\.99",
  "action": "replace",
  "params": { "find": "http://marius.hosting.99", "replacement": "http://192.168.1.50" },
  "enabled": true
}
```
```json
{
  "name": "Route images by date",
  "match_type": "mime",
  "pattern": "image/*",
  "action": "route_folder",
  "params": { "template": "Images/{YYYY}/{MM}/{DD}" },
  "enabled": true
}
```

## 6. AI Prediction Engine

The core differentiator. The AI learns your clipboard patterns and tries to predict what you'll copy next.

### 6.1 How It Works
1. **Context gathering**: On each clip event, collect:
   - Last 10 clips (text, type, timestamps)
   - Time of day, day of week
   - Active window title (sent from desktop client / AHK)
   - Tags and folders of recent clips
   - Current hotkey slot contents

2. **Prediction call**: Send context to OpenAI with a system prompt:
   ```
   You are a clipboard prediction engine. Based on the user's recent clipboard
   history and context, predict what they will copy next. Return your prediction
   as JSON: { "prediction": "...", "confidence": 0.0-1.0, "reasoning": "..." }
   ```

3. **Scoring**: When the user actually copies something:
   - Compare to the latest prediction
   - Use fuzzy matching (similarity threshold, e.g. >0.8 = correct)
   - Update running accuracy stats

4. **Learning**: The prediction prompt includes recent accuracy and past correct/incorrect predictions so the model can learn patterns over time.

### 6.2 Prediction Dashboard
- Current prediction displayed in a banner/widget
- Running accuracy percentage (big number)
- Streak counter (consecutive correct)
- Graph of accuracy over time
- List of recent predictions with correct/incorrect indicators

## 7. Desktop Hotkeys (AutoHotKey)

### 7.1 Hotkey Bindings
AutoHotKey v2 script that runs at startup:

| Hotkey | Action |
|--------|--------|
| `Ctrl+Alt+1` through `Ctrl+Alt+9` | Paste clip from slot 1-9 |
| `Ctrl+Alt+0` | Paste clip from slot 10 |
| `Ctrl+Alt+-` | Paste clip from slot 11 |
| `Ctrl+Alt+=` | Paste clip from slot 12 |
| `Ctrl+Alt+S` | Save current clipboard to next available slot |
| `Ctrl+Alt+P` | Show current AI prediction (tooltip) |
| `Ctrl+Alt+Space` | Open ClipSync in browser |

### 7.2 How AHK Talks to the Server
The AHK script communicates with the local Express server via HTTP:

```autohotkey
; Example: Paste from slot 3
^!3:: {
    response := HttpGet("http://localhost:5000/api/clips/hotkeys")
    clip := JSON.Parse(response).slots["3"]
    A_Clipboard := clip.text_content
    Send "^v"
}

; Example: Save current clipboard to server
^!s:: {
    content := A_Clipboard
    HttpPost("http://localhost:5000/api/clips", {
        content_type: "text/plain",
        text_content: content,
        source: "clipboard_monitor"
    })
}
```

### 7.3 Clipboard Monitoring
AHK monitors the system clipboard via `OnClipboardChange`. On every copy:
1. POST the content to `/api/clips` (which triggers rule engine + prediction scoring)
2. Show a brief tooltip with the clip preview
3. If AI prediction was correct, show a green flash

## 8. Frontend Pages

### 8.1 Clipboard Stream (main page)
- Real-time list of clips (newest first)
- Search bar with filters (type, tag, folder, date range)
- Per-clip actions: Copy, Pin, Star, Tag, Move to Folder, Assign Hotkey, Delete
- AI action dropdown: Summarize, Improve, Tags, Code Review, Email Draft, Ideas
- Inline AI chat panel at bottom

### 8.2 Predictions Dashboard
- Large accuracy percentage display
- Current prediction banner with confidence meter
- Prediction history timeline
- Streak counter and personal best
- Settings: enable/disable, prediction frequency, model selection

### 8.3 Rules Manager
- Table of rules with columns: Name, Match Type, Pattern, Action, Enabled (toggle)
- Add/Edit form with live preview ("Test this rule" button)
- Drag to reorder priority

### 8.4 Folders & Collections
- Tree view of folders
- Clips grouped by folder/tag
- Bulk operations (move, tag, delete)

### 8.5 Hotkey Manager
- Visual grid of 12 hotkey slots
- Drag clips into slots
- Shows current content of each slot
- AHK connection status indicator

### 8.6 Settings
- Server connection (API URL, for remote access)
- Database connection (for admin)
- AI provider config (OpenAI API key, model selection)
- Cloudflare Tunnel status
- AutoHotKey script download/status
- Theme (dark/light)

## 9. Environment Variables

```env
# Server
PORT=5000
DATABASE_URL=postgresql://user:pass@NAS_IP:5432/clipsync
JWT_SECRET=your-secret-here

# AI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Storage
BLOB_STORAGE_PATH=/path/to/blob/storage
# or
BLOB_STORAGE_URL=https://your-r2-bucket.example.com

# Optional
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
```

## 10. Hosting Architecture

```
┌─────────────────────────────────────────────────────┐
│  Windows Desktop                                     │
│  ┌───────────────┐  ┌──────────────────────────┐    │
│  │ AutoHotKey    │──│ Express Server (:5000)    │    │
│  │ Ctrl+Alt+1-12 │  │  - API routes            │    │
│  │ Clipboard Mon │  │  - Rule engine            │    │
│  └───────────────┘  │  - AI prediction          │    │
│                     │  - Serves React PWA       │    │
│  Browser: localhost:5000                         │    │
│                     └──────────┬─────────────────┘    │
└────────────────────────────────┼──────────────────────┘
                                 │ DATABASE_URL
                    ┌────────────▼────────────┐
                    │  Synology NAS           │
                    │  PostgreSQL (:5432)     │
                    │  Blob storage (volume)  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Cloudflare Tunnel      │
                    │  clipsync.yourdomain    │
                    │  → localhost:5000       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Phone / Tablet         │
                    │  PWA (installed)        │
                    │  Same UI, mobile layout │
                    └─────────────────────────┘
```

## 11. Instructions for AI Coder

You are the implementation agent for this repo. Follow these rules:

### Structure
- Only create files inside `server/`, `client/`, `desktop/`, and `infra/`.
- Do not rename top-level folders.

### Backend (server/)
1. Initialize with `npm init` + TypeScript + Express.
2. Install: `drizzle-orm`, `drizzle-kit`, `pg`, `@neondatabase/serverless` (or just `pg`), `jsonwebtoken`, `bcryptjs`, `zod`, `cors`, `ws`, `openai`.
3. Create Drizzle schema matching Section 3.
4. Implement all API routes from Section 4.
5. Implement the rule engine from Section 5.
6. Implement AI prediction engine from Section 6 (use OpenAI).
7. Implement AI workflows (summarize, improve, classify, etc.).
8. Serve the built client as static files in production.

### Frontend (client/)
1. Initialize with Vite + React + TypeScript.
2. Install: shadcn/ui, TailwindCSS v4, Framer Motion, React Query, React Hook Form, Zod, Wouter, Lucide icons.
3. Implement all pages from Section 8.
4. Use React Query for all API calls.
5. Implement Async Clipboard API for copy/paste.
6. Make it a PWA (manifest.json + service worker).
7. Responsive: works on desktop and mobile.

### Desktop (desktop/)
1. Create AutoHotKey v2 scripts from Section 7.
2. Include setup instructions.
3. The AHK script should auto-start with Windows (optional, documented).

### Infrastructure (infra/)
1. docker-compose.yml for NAS deployment (server + client + postgres optional).
2. Dockerfiles for server and client.
3. Cloudflare Tunnel setup guide.

### Build Order
1. Database schema + migrations
2. Auth endpoints
3. Clips CRUD + rule engine
4. AI service + prediction engine
5. Frontend: Clipboard Stream page
6. Frontend: remaining pages
7. AutoHotKey scripts
8. Docker + deployment configs

### Quality
- Full TypeScript strict mode.
- Zod validation on all inputs.
- Proper error handling with meaningful messages.
- Keep modules small and composable.
- Comment non-obvious logic.

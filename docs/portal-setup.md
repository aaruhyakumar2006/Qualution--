# QUALUTION Community Portal — Supabase Setup & Telemetry Architecture

This document provides complete instructions for running, developing, and deploying the **Community Portal** (telemetry portal) MVP powered by Supabase.

---

## 1. Architecture Overview

- **Frontend Client (`src/lib/supabase.ts`)**: Single typed Supabase client initialized with `@supabase/supabase-js`.
- **Environment Handling**:
  - `VITE_SUPABASE_URL`: Public HTTPS URL of the Supabase instance.
  - `VITE_SUPABASE_ANON_KEY`: Public anonymous API key (safe for browser exposure).
  - **CRITICAL SECURITY NOTE**: Never embed or commit the `service_role` key in frontend code or in Git. The service-role key bypasses Row Level Security (RLS) and is only for secure backend scripts / migrations.
- **Portal Feature Module (`src/features/portal/`)**:
  - `api/`: Telemetry logging and event retrieval functions using the typed client.
  - `components/`: UI components (`PortalHeader`, etc.).
  - `pages/`: Page containers (`PortalPage.tsx`).
  - `types/`: Strongly-typed schema definitions (`database.types.ts`).
- **Routing**:
  - Route: `/portal` (and `#portal`).
  - Implemented in `src/App.tsx` via the lightweight router with deep-linking support.

---

## 2. Prerequisites

1. **Node.js** (v18+) and **npm**.
2. **Supabase CLI**: Accessible directly via `npx supabase` (no global installation required).
3. **Docker Desktop** (optional for cloud development, required only for local Supabase emulator containers).

---

## 3. Environment Variables Configuration

Copy the template from `.env.example` into `qualution-frontend/.env`:

```bash
# In qualution-frontend/
cp .env.example .env
```

Populate the required keys:

```env
# Qualution Backend API
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1

# Supabase Telemetry & Community Portal Configuration
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...<your-anon-key>
```

> **Git Safety**: Both the repository root `.gitignore` and `qualution-frontend/.gitignore` ignore `.env`, `.env.*`, and `*.env`. Verify with `git status` that no secrets are staged.

### Test Environment Isolation (`.env.test`)
Automated test suites (Vitest) load `qualution-frontend/.env.test` automatically, isolating test runs from live/shared Supabase projects:
```env
# .env.test (used by Vitest)
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Command Project Targeting Reference
| Command | Working Directory | Target Database / Supabase Instance | Purpose |
| :--- | :--- | :--- | :--- |
| `npm run dev` | `qualution-frontend/` | Remote / Live Project defined in `.env` (`hihwyzxnuyjzgkwlmzlt.supabase.co`) | Interactive local development in browser |
| `npx vitest run` | `qualution-frontend/` | Local emulator defined in `.env.test` (`http://127.0.0.1:54321`) | Isolated automated unit & integration tests |
| `npx supabase db reset` | `semi-finals/` | Local Docker PostgreSQL instance (`localhost:54322`) | Re-runs all migrations + `seed.sql` from scratch |
| `npx supabase test db` | `semi-finals/` | Local Docker PostgreSQL instance (`localhost:54322`) | Runs pgTAP / SQL tests in `supabase/tests/` |
| `npx supabase db push` | `semi-finals/` | Linked Remote Project (`hihwyzxnuyjzgkwlmzlt`) | Deploys new versioned migrations to remote project |

---

## 4. Local Supabase Development (Docker Workflow)

If Docker Desktop is running locally:

### Start Local Supabase Stack
```bash
npx supabase start
```
This boots local Docker containers for:
- PostgreSQL database (`localhost:54322`)
- PostgREST API (`http://127.0.0.1:54321`)
- Supabase Studio Web UI (`http://127.0.0.1:54323`)
- Auth, Storage, and Realtime services

### Inspect Running Services and Credentials
```bash
npx supabase status
```

### Stop Local Supabase Stack
```bash
npx supabase stop
```

---

## 5. Database Migrations & Seeds

The database schema and seeds are versioned inside `supabase/`:
- `supabase/migrations/20261003000000_init_portal.sql`: Creates `portal_telemetry_events` table with indexes and RLS policies.
- `supabase/seed.sql`: Sample telemetry events for local development and test fixtures.

### Reset Local Database (Run Migrations + Seeds)
```bash
npx supabase db reset
```

### Create a New Migration
```bash
npx supabase migration new <migration_name>
```

### Apply Migrations to Remote Supabase Project

1. Login to your Supabase account:
   ```bash
   npx supabase login
   ```
2. Link your local repository to your remote Supabase project:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
3. Push unapplied migrations to the remote database:
   ```bash
   npx supabase db push
   ```

---

## 6. Seed Data & Production Isolation Safeguards

- **`supabase/seed.sql`**: Contains mock credentials and test posts for 4 personas (`student`, `researcher`, `teacher`, `admin`) and 6 sample opportunities.
- **Production Guard**: `seed.sql` contains an automated execution abort guard:
  ```sql
  IF current_database() ~* 'prod' OR current_setting('app.environment', true) = 'production' THEN
    RAISE EXCEPTION 'CRITICAL: Refusing to execute seed.sql on production database (%)', current_database();
  END IF;
  ```
- **Policy**: Demo accounts and seed records are strictly for **local development and ephemeral staging environments**. Never run `seed.sql` against production clusters.

---

## 7. Telemetry Retention & Privacy Architecture

- **Allow-listed Event Types**: Only predefined operational event types are permitted (`portal_view`, `circuit_simulation_run`, `challenge_start`, `challenge_complete`, `opportunity_view`, `post_view`, `resource_click`, `search_query`, `telemetry_heartbeat`).
- **Payload Bound**: Maximum 10 KB per event enforced via `chk_telemetry_payload_size`.
- **Anonymization & Zero Client-Spoofed PII**: Client payloads have user identifiers (`user_id`, `email`, `handle`) automatically stripped server-side. Authenticated `user_id` is assigned directly from `auth.uid()`.
- **Moderator-Only Raw Access**: Raw telemetry event streams are accessible only to accounts with `is_moderator() = true`. Public dashboards consume the aggregated view `portal_telemetry_summary`.
- **Retention Purging**: Telemetry events older than 90 days are purged via `public.cleanup_expired_telemetry_events(retention_days => 90)`. This function is scheduled as a periodic job via `pg_cron` or Supabase Edge Functions.

---

## 6. TypeScript Type Generation (`supabase gen types`)

TypeScript database types are located at:
`src/features/portal/types/database.types.ts`

### Option A: Generate from Local Supabase (Requires Docker)
```bash
# From semi-finals/qualution-frontend:
npm run types:supabase

# Or from workspace root:
npm run types:supabase
```
*Executes: `supabase gen types typescript --local > src/features/portal/types/database.types.ts`*

### Option B: Generate from Linked Remote Supabase Project (No Docker Required)
```bash
# From semi-finals/qualution-frontend:
npm run types:supabase:linked
```
*Executes: `supabase gen types typescript --linked > src/features/portal/types/database.types.ts`*

Alternatively, specify a project reference directly:
```bash
npx supabase gen types typescript --project-id <your-project-ref> --schema public > qualution-frontend/src/features/portal/types/database.types.ts
```

---

## 7. Verification & Testing

### 1. Build Verification
```bash
cd qualution-frontend
npx tsc --noEmit
npx vite build
```

### 2. Route & Integration Tests
```bash
cd qualution-frontend
npx vitest run src/features/portal/portalRoute.test.tsx
```

### 3. Launching in Browser
```bash
cd qualution-frontend
npm run dev
```
Navigate to: `http://localhost:5173/portal` (or `http://localhost:5173/#portal`) to verify the portal mounts with the "Portal" heading and UI.

---

## 8. Manual Walkthrough: Community Portal Posts & Feed

Follow this step-by-step walkthrough to verify all post, feed, and moderation features in the user interface.

### Step 1: Viewing the Community Feed
1. Open the browser to `http://localhost:5173/portal` (or navigate via the top navigation bar).
2. Verify the feed displays:
   - **Section Filter Tabs**: `All`, `Courses`, `News`, `Research`, `Events`, and `Qualution`.
   - **Post Cards**: Each card displays:
     - Author display name, handle, role, and verified badge (if verified).
     - Section tag pill (e.g. `Research`, `Courses`).
     - Relative timestamp (e.g. `Just now`, `2h ago`, `3d ago`).
     - Post title and body excerpt.
     - Normalized tag pills (clicking any tag filters the feed by that tag).
     - External link domain pill (e.g. `arxiv.org`) with `target="_blank" rel="noopener noreferrer"`.

### Step 2: Testing Keyset Pagination
1. Scroll to the bottom of the feed list.
2. If there are more posts than the page limit (default 10), observe the **"Load More Posts"** button.
3. Click **"Load More Posts"**:
   - The client invokes the keyset RPC `get_portal_posts_feed` passing `(created_at, id)` as the keyset cursor.
   - The subsequent page loads smoothly without jumping or N+1 queries.
   - When all posts have been retrieved, the button disappears and "You have reached the end of the feed" appears.

### Step 3: Filtering by Section and Tag
1. Click on the **"Research"** tab:
   - The feed instantly reloads showing only research papers.
2. Click on a tag (e.g., `#quantum`):
   - The active tag filter appears above the feed with a clear (`×`) button.
   - Keyset pagination resets automatically to the beginning of the filtered subset.
3. Click `×` to clear the filter.

### Step 4: Creating a Standard Post
1. Click the **"New Post"** button in the top action bar:
   - If not signed in, a login dialog or sign-in banner prompts authentication.
   - If signed in, the **"Create Post"** modal opens.
2. Select Section: `News`.
3. Fill in:
   - Title: `Quantum Advantage in Graph State Verification`
   - Body: `We observed verifiable quantum advantage utilizing cluster states in photonic circuits.`
   - Link URL: `https://qualution.org/announcements`
   - Tags: Type `quantum, photonics, cluster-state` (notice tags are automatically normalized to lowercase, trimmed, deduplicated, and limited to 5).
4. Click **"Publish Post"**:
   - The modal closes, a success toast appears, and the new post appears immediately at the top of the feed.

### Step 5: Creating a Research Post with Paper URL
1. Click **"New Post"** and choose Section: `Research`.
2. Notice the **Research Publication Metadata** section dynamically appears:
   - **Paper URL (Required)**: Enter a valid link (e.g. `https://arxiv.org/abs/2401.00001`).
   - If you leave this blank or enter an invalid protocol like `ftp://` or plain text, the form displays a visible Zod validation error: *"Research posts require a valid Paper URL starting with http:// or https://"*.
   - **Abstract (Optional)**: Enter paper abstract.
3. Fill in Title and Body and click **"Publish Post"**:
   - The post is published with a distinct "Read Research Paper" callout on the card.

### Step 6: Post Detail Page (`/portal/post/:id`)
1. Click on the title of any post card:
   - The URL updates to `/portal/post/<post_id>` (deep-linking supported).
   - The page renders the full post body via `SafeMarkdownRenderer`.
   - Verify that any raw HTML tags (e.g. `<script>`, `<iframe>`) are rendered strictly as inert harmless text, with zero execution or HTML injection.
   - Verify the author bio card on the right side with links to `/portal/u/:handle`.
   - Scroll to the bottom to verify the **Comments Placeholder**: *"Comments Coming Soon — Peer review discussions and threaded quantum debates will land here in an upcoming release."*

### Step 7: Editing and Deleting Own Post
1. On a post authored by the currently logged-in user, click the **Edit** icon:
   - The **"Edit Post"** modal opens pre-filled with the title, body, link, and tags.
   - Notice the form does **not** allow altering the author, status, or created_at timestamp.
2. Modify the title and click **"Save Changes"**:
   - The post updates instantly.
3. Click the **Delete** (trash) icon:
   - Confirm deletion in the confirmation dialog.
   - The post is hard-deleted from the database via the author's RLS `DELETE` permission and immediately disappears from the feed.

### Step 8: Database Rate Limiting Verification
1. Rapidly attempt to create more than 10 posts within 1 hour using the same account.
2. On the 11th post attempt, the database trigger `tr_rate_limit_posts` raises exception code `P0002`.
3. The UI catches this code and displays a friendly error banner:
   *"Rate limit reached: You can create up to 10 posts per hour. Please wait before posting again."*


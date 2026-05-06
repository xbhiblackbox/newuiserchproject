# Master Prompt: Railway Backend & DB Replication

**Dear AntiGravity (or AI Assistant),**

I have provided you with a ZIP file containing the complete source code for my Instagram Clone / Analytics project. This project consists of a React/Vite frontend and a Node.js/Express backend that was previously migrated from Supabase to Railway.

**Your objective is to fully deploy and configure the backend for this project using your Agentic/Browser mode or by guiding me through the local CLI steps.**

Here is the exact blueprint of what has been built and what you need to replicate on the new Railway environment:

### 1. The Architecture
*   **Frontend:** React (Vite) located in the root directory. It expects `VITE_API_BASE_URL` to point to the new backend.
*   **Backend:** Node.js (Express) located in the `backend/` folder. It serves both the REST APIs (`/functions/v1/*`) and hosts the static frontend build.
*   **Database:** PostgreSQL (hosted on Railway).

### 2. Task 1: PostgreSQL Database Setup
1.  Navigate to Railway (or use the Railway CLI/Dashboard) and provision a new **PostgreSQL** database.
2.  Obtain the `DATABASE_URL` (Connection String).
3.  Execute the migration script located at `backend/migrations/001_init.sql` against this new database.
    *   This will create the following tables: `access_keys`, `api_settings`, `reels_data`, and `search_cache`.
    *   It will also seed `api_settings` with `id=1`.

### 3. Task 2: Backend Environment Variables
Set up the following environment variables in the Railway Backend service:
*   `DATABASE_URL`: The PostgreSQL connection URL you just created.
*   `TELEGRAM_BOT_TOKEN`: The token for the Telegram Bot (I will provide this).
*   `TELEGRAM_ADMIN_CHAT_ID_1` (and `_2`): The Telegram Chat IDs of the admins.
*   `RAPIDAPI_KEY`: The default fallback RapidAPI key (I will provide this).
*   `RAPIDAPI_HOST`: `instagram120.p.rapidapi.com`

### 4. Task 3: Backend Deployment
1.  Ensure the `backend/package.json` has the correct start scripts.
2.  Deploy the `backend/` directory to Railway as a Node.js web service.
3.  Once deployed, get the public domain URL (e.g., `https://my-new-app.up.railway.app`).

### 5. Task 4: Frontend Connection & Telegram Webhook
1.  Update the frontend `.env` file to set `VITE_API_BASE_URL` to the new Railway domain.
2.  Build the frontend (`npm run build`) and ensure the `backend/src/server.ts` is configured to serve the `dist` folder.
3.  Hit the endpoint `https://<YOUR_RAILWAY_URL>/functions/v1/setup-webhook` to automatically register the Telegram Bot webhook with the new Railway URL.

### 6. Special Backend Logic to Keep in Mind (Context for AI):
*   **KeyGuard & Auto-Logout:** The `check-key-status.ts` API issues a `logout: true` flag ONLY when the device limit is strictly reached or a key is revoked/expired. It caches device fingerprints locally.
*   **Cache Isolation:** `instagram-scraper.ts` generates cache keys scoped to `deviceFingerprint` (`v1:{deviceFp}:username`) to prevent RapidAPI data from mixing across different users.
*   **Quota Alerts:** The `rapidapi.ts` file automatically tracks API usage and will ping the Telegram admins when searches are running low (<= 10 and <= 5). Admins can reply `/setapi NEW_KEY` directly to the bot to hot-swap the RapidAPI key without redeploying.

**Please begin by confirming you understand these instructions, and then proceed to step 1 (Database Creation) using your browser tools or terminal.**

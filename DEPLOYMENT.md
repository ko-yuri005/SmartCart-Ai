# SmartCart AI — Production Deployment Guide (Vercel + Render / Railway)

This guide covers deploying **SmartCart AI** with:
1. **Render or Railway** hosting the persistent **Express / TypeScript / SQLite** backend (`server/`) backed by a persistent disk volume.
2. **Vercel** hosting the **React 19 / Vite 6** frontend (`client/`) and proxying `/api/*` requests to the backend on the same origin.

---

## Architecture Overview

- **Catalogue & Seed Integrity**: On startup (`npm start` -> `node dist/server.js`), `startServer()` opens the SQLite database at `DATABASE_FILE`, runs schema & incremental marketplace migrations (`initMarketplaceTables`), and executes `runSeed(false)`, which non-destructively upserts all **449 catalogue products**, product variants, verified images, and coupons into the persistent SQLite database without overwriting existing customer carts, orders, reviews, or accounts.
- **Same-Origin API Proxy**: The Vercel frontend makes requests to relative `/api/*` paths (`BASE_URL = ''`). `vercel.json` rewrites `/api/:path*` to your Render or Railway backend URL (`https://<your-backend-domain>/api/:path*`). Because the browser communicates with `/api/*` on the Vercel domain:
  - `HttpOnly; SameSite=Lax; Secure` authentication cookies (`shp_session`) work as first-party cookies.
  - `Authorization: Bearer <token>` and `x-csrf-token` headers pass straight through.
- **Visual Search Upload Reliability**: `ChatInput.tsx` automatically optimizes photos larger than `2.2 MB` (or wider/taller than `1600px`) via an offscreen canvas (`image/jpeg` at `0.86` quality) before encoding to base64 JSON, ensuring visual search requests stay well below Vercel's `4.5 MB` rewrite proxy body limit while preserving valid JPEG magic bytes (`0xFF 0xD8 0xFF`).

---

## Step 1: Deploy the Backend (Render or Railway)

### Option A: Deploy Backend on Render (Using `render.yaml`)

1. Push the repository to GitHub/GitLab.
2. In the **Render Dashboard**, click **New + → Blueprint** and select your repository (Render will detect [`render.yaml`](./render.yaml)), **or** create a **New Web Service** with:
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
3. **Attach a Persistent Disk** (Required for SQLite persistence):
   - Go to **Disks → Add Disk**
   - **Name**: `smartcart-sqlite-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (or larger)
4. **Set Environment Variables in Render**:
   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `5000` |
   | `DATABASE_FILE` | `/var/data/shopping.sqlite` |
   | `GEMINI_API_KEY` | `<your-google-gemini-api-key>` |
   | `GEMINI_MODEL` | `gemini-2.5-flash` |
   | `ENABLE_DEMO_ADMIN` | `false` |
   | `ADMIN_BOOTSTRAP_USERNAME` | `admin` |
   | `ADMIN_BOOTSTRAP_EMAIL` | `admin@smartcart.ai` |
   | `ADMIN_BOOTSTRAP_PASSWORD` | `<strong-password-at-least-8-chars>` |
   | `CORS_ALLOWED_ORIGINS` | `https://<your-project>.vercel.app,https://*.vercel.app` |
5. Deploy the service and verify `https://<your-render-service>.onrender.com/api/health` returns `"status": "ok"` and `"productCount": 449`.

---

### Option B: Deploy Backend on Railway (Using `railway.json`)

1. In the **Railway Dashboard**, click **New Project → Deploy from GitHub repo**.
2. Railway will detect [`railway.json`](./railway.json) at the repository root (or set **Root Directory** to `server` with Build Command `npm install && npm run build` and Start Command `npm start`).
3. **Attach a Persistent Volume**:
   - Right-click the service in Railway → **Attach Volume**
   - **Mount Path**: `/data`
4. **Set Environment Variables in Railway**:
   - Set the same variables listed above, with:
     - `DATABASE_FILE=/data/shopping.sqlite`
5. Generate a public domain in Railway (**Settings → Networking → Generate Domain**) and verify `https://<your-railway-domain>.up.railway.app/api/health` returns `"status": "ok"` and `"productCount": 449`.

---

## Step 2: Secure Initial Admin Setup in Production

- **Demo Admin Disabled in Production**: When `NODE_ENV=production`, the local development demo credentials (`admin` / `admin`) are **strictly disabled** in both `AuthService.bootstrapInitialAdmin()` and `AuthService.login()`, and the demo credential hint is hidden in the production frontend build.
- **How to Bootstrap Your Production Admin**:
  1. Set `ADMIN_BOOTSTRAP_USERNAME` (e.g. `admin`), `ADMIN_BOOTSTRAP_EMAIL` (e.g. `admin@smartcart.ai`), and a strong `ADMIN_BOOTSTRAP_PASSWORD` (at least 8 characters, never `admin`) in your Render/Railway environment variables.
  2. On first boot (or if a pre-existing database still had the default `admin` password), `AuthService.bootstrapInitialAdmin()` hashes `ADMIN_BOOTSTRAP_PASSWORD` using `scrypt` (`salt` + `64-byte key`) and activates the administrator account with `must_change_password = 0`.
  3. Once the admin account is created in `/var/data/shopping.sqlite`, you can sign in via the **Account** tab on the website and open the **Admin Marketplace Dashboard**, or rotate the password anytime via the **Change Password** form.

---

## Step 3: Deploy the Frontend on Vercel

1. Update the backend URL in [`vercel.json`](./vercel.json) (and [`client/vercel.json`](./client/vercel.json)):
   Replace `https://smartcart-ai-api.onrender.com` with your actual deployed Render or Railway backend URL:
   ```json
   "rewrites": [
     {
       "source": "/api/:path*",
       "destination": "https://<your-backend-service>.onrender.com/api/:path*"
     },
     {
       "source": "/((?!api/).*)",
       "destination": "/index.html"
     }
   ]
   ```
2. Import the repository into **Vercel**:
   - **Option 1 (Root Directory = `.`)**: Vercel uses the root [`vercel.json`](./vercel.json) (`installCommand`: `npm --prefix client install`, `buildCommand`: `npm --prefix client run build`, `outputDirectory`: `client/dist`).
   - **Option 2 (Root Directory = `client`)**: Vercel uses [`client/vercel.json`](./client/vercel.json) (`buildCommand`: `npm run build`, `outputDirectory`: `dist`).
3. Leave `VITE_API_BASE_URL` unset (or empty) in Vercel Environment Variables so all `/api/*` requests use the same-origin Vercel rewrite proxy.
4. Click **Deploy** (or run `npx vercel --prod`).

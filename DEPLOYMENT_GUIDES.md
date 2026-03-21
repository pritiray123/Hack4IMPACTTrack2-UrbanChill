# Platform Deployment Guides (Vercel & Railway)

This guide provides instructions for deploying HeatGuard on **Vercel** (Cloud) and **Railway** (Container-friendly).

---

## 🚉 Railway Deployment (Recommended for Monoliths)

Railway is the best choice because it supports **Docker** and **Persistent Volumes**, which are needed for your SQLite database (`heatguard.db`).

### Step 1: Prepare for Railway
1.  **Repository**: Push your code to a GitHub/GitLab repository.
2.  **Environment Variables**: Decide on your `GEMINI_API_KEY` and `OWM_API_KEY`.

### Step 2: Deploy on Railway
1.  Go to [Railway.app](https://railway.app/) and login with GitHub.
2.  Click **"New Project"** -> **"Deploy from GitHub repo"**.
3.  Choose the repo `Hack4IMPACTTrack2-UrbanChill`.
4.  **Before it builds**: Click on the service -> **Variables**.
5.  Add all variables from `.env.example`:
    - `PORT=5000`
    - `JWT_SECRET=...`
    - `GEMINI_API_KEY=...`
    - `OWM_API_KEY=...`
    - `NODE_ENV=production`

### Step 3: Setup Persistence (CRITICAL)
Railway will reset your `heatguard.db` on every deploy unless you add a volume.
1.  In Railway, click **"Add Service"** or go to your service settings.
2.  Click **"Volumes"** -> **"New Volume"**.
3.  Mount the volume at `/app/heatguard-backend/data`.
4.  **Note**: You will need to update `db.js` to point to `/app/heatguard-backend/data/heatguard.db`.

---

## 📐 Vercel Deployment (Best for Frontend)

Vercel is great for the frontend but requires an **External Database** for the backend (SQLite won't work).

### Step 1: External Database Setup
1.  Create a free database at [Supabase](https://supabase.com/) or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2.  Get your Connection String.
3.  **Code Change**: Update your backend to connect to this new DB instead of SQLite.

### Step 2: Configure `vercel.json`
Create a `vercel.json` in your root directory:
```json
{
  "version": 2,
  "builds": [
    { "src": "heatguard/package.json", "use": "@vercel/static-build" },
    { "src": "heatguard-backend/server.js", "use": "@vercel/node" }
  ],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "heatguard-backend/server.js" },
    { "source": "/(.*)", "destination": "heatguard/$1" }
  ]
}
```

### Step 3: Deploy on Vercel
1.  Push code to GitHub.
2.  Go to [Vercel.com](https://vercel.com/) -> **"Add New"** -> **"Project"**.
3.  Import the repository.
4.  Vercel will detect the `package.json` files and use the `vercel.json` for routing.
5.  **Environment Variables**: Add your `GEMINI_API_KEY`, etc., in the Vercel dashboard.

---

## ⚖️ Comparison Summary

| Feature | Railway | Vercel |
| :--- | :--- | :--- |
| **Monolith Support** | Excellent (Native Docker) | Possible (via rewrites) |
| **Database** | Supports SQLite (w/ volumes) | Requires External DB |
| **Persistence** | Yes | No (Serverless) |
| **Ease for this App** | **High** | Medium |

### Final Tip:
For this specific project, **Railway** is much easier because it allows you to keep your existing SQLite code exactly as it is, as long as you use a Persistent Volume.

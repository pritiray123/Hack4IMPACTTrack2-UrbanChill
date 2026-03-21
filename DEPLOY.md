# Deployment Guide: HeatGuard

This guide provides instructions for deploying the HeatGuard application in a production environment.

## 1. Prerequisites
- Node.js (v18+)
- Docker (optional, for containerized deployment)
- API Keys:
  - `GEMINI_API_KEY` (from Google AI Studio)
  - `OWM_API_KEY` (from OpenWeatherMap)

## 2. Environment Configuration

### Frontend (`heatguard/.env.production`)
The frontend is pre-configured to use the relative path or an environment variable for the API base.
```env
VITE_API_BASE_URL=/api
```

### Backend (`heatguard-backend/.env`)
Create a `.env` file in the `heatguard-backend` directory:
```env
PORT=5000
JWT_SECRET=your_production_secret
GEMINI_API_KEY=your_key
OWM_API_KEY=your_key
NODE_ENV=production
```

## 3. Local Production Build

To test the production build locally:

1.  **Build Frontend**:
    ```bash
    cd heatguard
    npm install
    npm run build
    ```

2.  **Start Backend**:
    ```bash
    cd ../heatguard-backend
    npm install
    node server.js
    ```
    The app will be available at `http://localhost:5000`.

## 4. Docker Deployment (Recommended)

1.  **Build the Image**:
    ```bash
    docker build -t heatguard:latest .
    ```

2.  **Run the Container**:
    ```bash
    docker run -d \
      -p 5000:5000 \
      -e GEMINI_API_KEY=your_key \
      -e OWM_API_KEY=your_key \
      -e JWT_SECRET=your_secret \
      heatguard:latest
    ```

## 5. Security Notes
- Ensure `JWT_SECRET` is at least 32 characters long.
- Use a reverse proxy (like Nginx) for SSL/TLS termination.
- Regularly update the `heatguard.db` (SQLite) backups.

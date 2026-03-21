# --- STAGE 1: Frontend Build ---
FROM node:20 AS frontend-builder
WORKDIR /app/heatguard
COPY heatguard/package*.json ./
RUN npm install
COPY heatguard/ ./
RUN npm run build

# --- STAGE 2: Backend Build ---
FROM node:20 AS backend-builder
WORKDIR /app/heatguard-backend
# Copy package files and install ALL dependencies (including devDependencies if needed for build)
COPY heatguard-backend/package*.json ./
RUN npm install

# Copy source and other files
COPY heatguard-backend/ ./

# --- STAGE 3: Final Production Image ---
FROM node:20-slim
WORKDIR /app

# Copy built frontend assets
COPY --from=frontend-builder /app/heatguard/dist ./heatguard/dist

# Copy backend files and built node_modules from builder
COPY --from=backend-builder /app/heatguard-backend ./heatguard-backend

# Expose port
EXPOSE 5000

# Environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Start command
CMD ["node", "heatguard-backend/server.js"]

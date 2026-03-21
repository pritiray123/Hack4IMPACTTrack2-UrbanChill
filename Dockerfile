# Use an official Node.js runtime as a parent image
FROM node:20-slim AS builder

# Set the working directory for the frontend build
WORKDIR /app/heatguard
COPY heatguard/package*.json ./
RUN npm install
COPY heatguard/ ./
RUN npm run build

# Set the working directory for the final image
FROM node:20-slim

WORKDIR /app

# Copy backend files
COPY heatguard-backend/package*.json ./heatguard-backend/
RUN cd heatguard-backend && npm install --production

COPY heatguard-backend/ ./heatguard-backend/

# Copy built frontend files to where the backend expects them
COPY --from=builder /app/heatguard/dist ./heatguard/dist

# Expose the port the app runs on
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Command to run the application
CMD ["node", "heatguard-backend/server.js"]

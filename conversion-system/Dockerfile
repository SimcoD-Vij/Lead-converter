# Use official Node.js 20 image (LTS)
FROM node:20-slim

# Install system dependencies (needed for some node modules like canvas or ngrok binary compatibility)
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose ports
# 3000 = Internal Voice Server / Ngrok Target
# 8082 = Gateway Server
EXPOSE 3000
EXPOSE 8082

# Define environment variable defaults
ENV NODE_ENV=production

# Start the unified system
CMD ["node", "start_system.js"]

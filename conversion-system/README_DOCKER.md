# Hivericks Conversion System - Docker Guide

This guide explains how to run the Hivericks system using Docker. This ensures the application runs exactly the same way on any machine.

## Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

## Setup Instructions

### 1. Configure Environment
The application needs your API keys to function.
1. Duplicate the file `.env.example`.
2. Rename the copy to `.env`.
3. Open `.env` and fill in your keys (Twilio, Email, etc.).

> **Note**: The `.env` file is where you manage your configuration. Docker will read this file every time it starts.

### 2. Run the Application
Open a terminal in this folder and run:

```bash
docker-compose up --build
```

- **`--build`**: Tells Docker to build the image (do this the first time or if you change code).
- **`up`**: Starts the system.

To run in the background (detached mode):
```bash
docker-compose up -d
```

### 3. Verify it's Running
You should see logs indicating the services are starting:
- `[SERVER] Starting...`
- `[ORCHESTRATOR] Starting...`

The system exposes:
- **Port 3000**: Voice Server
- **Port 8082**: Gateway Server

### 4. Stopping the System
Press `Ctrl+C` in the terminal, or if running detached:
```bash
docker-compose down
```

## Data Persistence
The configuration connects your local files to the Docker container. This means:
- If the system updates `clean_leads.json`, the change appears in your local folder.
- Call logs and conversations are saved to your local `voice/` directory.
- **You will not lose data** when you stop or restart the container.

## Troubleshooting
- **Ngrok Issues**: If you see ngrok errors, ensure the `.env` `SERVER_URL` matches your active ngrok domain.
- **Port Conflicts**: If port 3000 is used by another app, you can change the mapping in `docker-compose.yml` (e.g., `"3001:3000"`).

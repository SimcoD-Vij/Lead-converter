from pyngrok import ngrok
import time
import sys

# Start a tunnel on port 8000
try:
    public_url = ngrok.connect(8000).public_url
    print(f"NGROK_URL={public_url}")
    print("Tunnel started. Press Ctrl+C to stop.")
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Stopping tunnel...")
    ngrok.kill()
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

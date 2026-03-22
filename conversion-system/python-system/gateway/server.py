# ---------------------------------------------------------
# gateway/server.py
# Unified Gateway Server (Port 8082) - replaces gateway/server.js
# ---------------------------------------------------------
from __future__ import annotations

import httpx
from flask import Flask, Response, request

from core.config import EMAIL_QUEUE_FILE, SMS_QUEUE_FILE
from core.file_io import read_json, write_json

app = Flask(__name__)
PORT = 8082
VOICE_SERVER_URL = "http://localhost:3000"


@app.route("/sms", methods=["POST"])
def incoming_sms() -> Response:
    """Immediately queues incoming SMS and ACKs Twilio."""
    from_num = request.values.get("From", "")
    body = request.values.get("Body", "")
    print(f"\n📨 GATEWAY: Received SMS from {from_num}. Queuing...")

    try:
        queue = read_json(SMS_QUEUE_FILE, fallback=[])
        from datetime import datetime, timezone
        queue.append({
            "lead_id": from_num,
            "message": body,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "PENDING",
        })
        write_json(SMS_QUEUE_FILE, queue)
        print(f"   ✅ Queued. Current Size: {len(queue)}")
    except Exception as e:
        print(f"   ❌ GATEWAY ERROR: Failed to queue SMS: {e}")

    # Empty TwiML response to prevent Twilio timeout
    return Response("<Response></Response>", mimetype="text/xml")


@app.route("/email", methods=["POST"])
def incoming_email() -> Response:
    """Immediately queues incoming emails."""
    sender = request.json.get("sender") if request.is_json else request.values.get("sender")
    subject = request.json.get("subject") if request.is_json else request.values.get("subject")
    body = request.json.get("body") if request.is_json else request.values.get("body")

    print(f"\n📧 GATEWAY: Received Email from {sender}. Queuing...")

    try:
        queue = read_json(EMAIL_QUEUE_FILE, fallback=[])
        from datetime import datetime, timezone
        queue.append({
            "sender": sender,
            "subject": subject,
            "body": body,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "PENDING",
        })
        write_json(EMAIL_QUEUE_FILE, queue)
        print(f"   ✅ Email Queued. Current Size: {len(queue)}")
    except Exception as e:
        print(f"   ❌ GATEWAY ERROR: Failed to queue Email: {e}")

    return Response("OK", status=200)


@app.route("/voice", defaults={"path": ""}, methods=["GET", "POST", "PUT", "DELETE"])
@app.route("/voice/<path:path>", methods=["GET", "POST", "PUT", "DELETE"])
def proxy_to_voice(path: str) -> Response:
    """Proxies all /voice traffic to the internal call server."""
    target_url = f"{VOICE_SERVER_URL}/voice"
    if path:
        target_url = f"{target_url}/{path}"

    try:
        headers = dict(request.headers)
        headers.pop("Host", None)
        headers.pop("Content-Length", None)

        data = request.form.to_dict() if request.form else request.get_data()

        # Synchronous proxy since Flask is synced here
        res = httpx.request(
            method=request.method,
            url=target_url,
            data=data,
            headers=headers,
            params=request.args,
            timeout=15.0,
        )

        excluded_headers = {"content-encoding", "content-length", "transfer-encoding", "connection"}
        res_headers = [
            (name, value) for name, value in res.headers.items()
            if name.lower() not in excluded_headers
        ]

        return Response(res.content, res.status_code, res_headers)

    except Exception as e:
        print(f"   ❌ GATEWAY PROXY ERROR: {e}")
        return Response(
            "<Response><Say>System is currently busy. Please try again later.</Say></Response>",
            status=200,
            mimetype="text/xml",
        )


if __name__ == "__main__":
    print(f"\n🌍 UNIFIED GATEWAY LISTENING ON PORT {PORT}")
    print(f"   👉 SMS/Email Queued internally")
    print(f"   👉 Voice Proxied to {VOICE_SERVER_URL}")
    app.run(host="0.0.0.0", port=PORT)


import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import edge_tts
import asyncio

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
# Voice Selection
# "en-US-ChristopherNeural" - High quality US Male
# "en-IN-PrabhatNeural" - High quality Indian Male (Fits "Vijay" persona?)
# Let's start with Christopher for clarity, but Prabhat is an option.
VOICE = "en-US-ChristopherNeural" 

app = FastAPI(title="Molly.myvoice Engine (Edge)")

class TTSRequest(BaseModel):
    text: str
    speed: float = 1.2  # Edge is naturally fast, 1.2 is good.

@app.post("/tts")
async def tts_endpoint(request: TTSRequest):
    if not request.text:
        raise HTTPException(status_code=400, detail="Text required")

    # Map float speed to Edge TTS rate format (e.g., "+20%")
    # 1.0 -> +0%
    # 1.5 -> +50%
    rate_pct = int((request.speed - 1.0) * 100)
    rate_str = f"{rate_pct:+d}%"

    print(f"🎙 Generating: '{request.text}' [{VOICE}, {rate_str}]")

    communicate = edge_tts.Communicate(request.text, VOICE, rate=rate_str)

    async def audio_generator():
        try:
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
        except Exception as e:
            print(f"❌ Edge Streaming Error: {e}")
            pass

    return StreamingResponse(
        audio_generator(),
        media_type="audio/mpeg"  # Edge returns MP3 usually
    )

if __name__ == "__main__":
    print(f"🚀 Starting Edge TTS Server on Port 8020 (Voice: {VOICE})")
    uvicorn.run(app, host="0.0.0.0", port=8020)

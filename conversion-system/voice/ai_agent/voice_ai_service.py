"""
Voice AI Service - FastAPI application for handling AI voice calls
Provides HTTP and WebSocket endpoints for voice conversation management
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict
from loguru import logger
import asyncio
import json
import sys

# Configure logging
logger.remove()
logger.add(sys.stderr, level="INFO")
logger.add("voice_ai_service.log", rotation="1 day", retention="7 days", level="DEBUG")

from config import config
from service_factory import create_llm_service, create_tts_service, create_stt_service
from workflow_manager import WorkflowGraph
from pipecat_engine import SimplePipecatEngine

# Initialize FastAPI app
app = FastAPI(
    title="Voice AI Agent Service",
    description="AI-powered voice conversation service using Pipecat framework",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active call sessions
active_sessions: Dict[str, SimplePipecatEngine] = {}


class CallInitRequest(BaseModel):
    """Request to initiate a new call"""
    call_id: str
    phone_number: str
    caller_name: Optional[str] = None
    context: Optional[Dict] = None


class CallStatusResponse(BaseModel):
    """Response with call status"""
    call_id: str
    status: str
    current_node: Optional[str] = None
    gathered_context: Optional[Dict] = None


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Voice AI Agent",
        "status": "running",
        "version": "1.0.0",
        "llm_provider": config.llm.provider,
        "tts_provider": config.tts.provider,
        "stt_provider": config.stt.provider
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "active_calls": len(active_sessions),
        "config": {
            "llm": f"{config.llm.provider}/{config.llm.model}",
            "tts": f"{config.tts.provider}/{config.tts.voice}",
            "stt": f"{config.stt.provider}/{config.stt.model}"
        }
    }


@app.post("/call/init")
async def initialize_call(request: CallInitRequest):
    """
    Initialize a new AI voice call
    
    This endpoint prepares the AI agent for a new conversation.
    It creates the workflow, LLM services, and engine instance.
    """
    call_id = request.call_id
    
    logger.info(f"[{call_id}] Initializing call for {request.phone_number}")
    
    try:
        # Create workflow
        workflow = WorkflowGraph.create_sales_workflow()
        
        # Create AI services
        llm = create_llm_service()
        tts = create_tts_service()
        stt = create_stt_service()
        
        # Prepare call context
        call_context = {
            "phone_number": request.phone_number,
            "caller_name": request.caller_name or "Customer",
            **(request.context or {})
        }
        
        # Create engine instance
        engine = SimplePipecatEngine(
            llm=llm,
            workflow=workflow,
            call_context_vars=call_context,
            call_id=call_id
        )
        
        # Store in active sessions
        active_sessions[call_id] = engine
        
        logger.info(f"[{call_id}] Call initialized successfully")
        
        return {
            "call_id": call_id,
            "status": "initialized",
            "workflow_start": workflow.start_node_id
        }
    
    except Exception as e:
        logger.error(f"[{call_id}] Failed to initialize call: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/call/{call_id}/status")
async def get_call_status(call_id: str) -> CallStatusResponse:
    """Get the current status of a call"""
    
    if call_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Call not found")
    
    engine = active_sessions[call_id]
    
    return CallStatusResponse(
        call_id=call_id,
        status="active" if not engine._call_ended else "ended",
        current_node=engine._current_node.name if engine._current_node else None,
        gathered_context=engine.get_gathered_context()
    )


@app.post("/call/{call_id}/end")
async def end_call(call_id: str):
    """End an active call"""
    
    if call_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Call not found")
    
    engine = active_sessions[call_id]
    
    logger.info(f"[{call_id}] Ending call via API")
    
    await engine.end_call(reason="api_request")
    
    # Get final context before removing
    final_context = engine.get_gathered_context()
    
    # Remove from active sessions
    del active_sessions[call_id]
    
    return {
        "call_id": call_id,
        "status": "ended",
        "gathered_context": final_context
    }


@app.websocket("/ws/call/{call_id}")
async def websocket_call_handler(websocket: WebSocket, call_id: str):
    """
    WebSocket endpoint for real-time voice streaming
    
    This handles bidirectional audio streaming between the client and AI agent.
    Audio flows: Client -> STT -> LLM -> TTS -> Client
    """
    await websocket.accept()
    
    logger.info(f"[{call_id}] WebSocket connected")
    
    if call_id not in active_sessions:
        await websocket.close(code=4404, reason="Call not initialized")
        return
    
    engine = active_sessions[call_id]
    
    try:
        # Initialize the engine
        await engine.initialize()
        
        # Send initial greeting
        await websocket.send_json({
            "type": "status",
            "message": "AI agent ready",
            "node": engine._current_node.name
        })
        
        # Handle incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                msg_type = message.get("type")
                
                if msg_type == "audio":
                    # Handle audio data (would be processed by STT in full implementation)
                    logger.debug(f"[{call_id}] Received audio data")
                    # In production: audio -> STT -> LLM -> TTS -> send back
                    
                elif msg_type == "text":
                    # Handle text input (for testing)
                    user_text = message.get("text", "")
                    logger.info(f"[{call_id}] User said: {user_text}")
                    
                    # Send acknowledgment
                    await websocket.send_json({
                        "type": "response",
                        "text": f"Received: {user_text}",
                        "node": engine._current_node.name
                    })
                
                elif msg_type == "end":
                    logger.info(f"[{call_id}] Client requested call end")
                    await engine.end_call(reason="client_hangup")
                    break
            
            except WebSocketDisconnect:
                logger.info(f"[{call_id}] WebSocket disconnected")
                break
            except json.JSONDecodeError:
                logger.warning(f"[{call_id}] Invalid JSON received")
                continue
    
    except Exception as e:
        logger.error(f"[{call_id}] WebSocket error: {e}")
    
    finally:
        # Cleanup
        if call_id in active_sessions:
            final_context = active_sessions[call_id].get_gathered_context()
            logger.info(f"[{call_id}] Final context: {final_context}")
            del active_sessions[call_id]
        
        logger.info(f"[{call_id}] WebSocket closed")


if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting Voice AI Service on {config.host}:{config.port}")
    logger.info(f"LLM: {config.llm.provider}/{config.llm.model}")
    logger.info(f"TTS: {config.tts.provider}/{config.tts.voice}")
    logger.info(f"STT: {config.stt.provider}/{config.stt.model}")
    
    uvicorn.run(
        "voice_ai_service:app",
        host=config.host,
        port=config.port,
        reload=config.debug,
        log_level="info"
    )

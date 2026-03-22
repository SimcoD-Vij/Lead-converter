"""
Configuration for AI Agent Service
Loads environment variables and provides configuration objects
"""
import os
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class LLMConfig(BaseModel):
    """LLM Service Configuration"""
    provider: str = "openai"
    model: str = "gpt-4"
    api_key: str
    temperature: float = 0.7
    max_tokens: int = 500


class TTSConfig(BaseModel):
    """Text-to-Speech Configuration"""
    provider: str = "openai"
    api_key: str
    voice: str = "alloy"
    model: str = "tts-1"


class STTConfig(BaseModel):
    """Speech-to-Text Configuration"""
    provider: str = "deepgram"
    api_key: str
    model: str = "nova-2"
    language: str = "en-US"


class ServiceConfig(BaseModel):
    """Main Service Configuration"""
    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = False
    
    llm: LLMConfig
    tts: TTSConfig
    stt: STTConfig


def load_config() -> ServiceConfig:
    """Load configuration from environment variables"""
    
    # LLM Configuration
    llm_config = LLMConfig(
        provider=os.getenv("LLM_PROVIDER", "openai"),
        model=os.getenv("LLM_MODEL", "gpt-4"),
        api_key=os.getenv("OPENAI_API_KEY", ""),
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
        max_tokens=int(os.getenv("LLM_MAX_TOKENS", "500"))
    )
    
    # TTS Configuration
    tts_config = TTSConfig(
        provider=os.getenv("TTS_PROVIDER", "openai"),
        api_key=os.getenv("OPENAI_API_KEY", ""),
        voice=os.getenv("TTS_VOICE", "alloy"),
        model=os.getenv("TTS_MODEL", "tts-1")
    )
    
    # STT Configuration
    stt_config = STTConfig(
        provider=os.getenv("STT_PROVIDER", "deepgram"),
        api_key=os.getenv("DEEPGRAM_API_KEY", ""),
        model=os.getenv("STT_MODEL", "nova-2"),
        language=os.getenv("STT_LANGUAGE", "en-US")
    )
    
    return ServiceConfig(
        host=os.getenv("AI_AGENT_HOST", "0.0.0.0"),
        port=int(os.getenv("AI_AGENT_PORT", "8001")),
        debug=os.getenv("DEBUG", "false").lower() == "true",
        llm=llm_config,
        tts=tts_config,
        stt=stt_config
    )


# Global config instance
config = load_config()

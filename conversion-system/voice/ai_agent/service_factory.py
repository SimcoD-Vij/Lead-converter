"""
Service Factory for creating LLM, TTS, and STT services
Adapted from Dograh's service factory pattern
"""
from typing import Optional
from loguru import logger

# Pipecat service imports
from pipecat.services.openai import OpenAILLMService, OpenAITTSService
from pipecat.services.deepgram import DeepgramSTTService

from config import ServiceConfig, config


import os
from typing import Optional
from loguru import logger

# Pipecat service imports
from pipecat.services.openai import OpenAILLMService, OpenAITTSService
from pipecat.services.deepgram import DeepgramSTTService

try:
    from local_tts_service import CustomLocalTTSService
except ImportError:
    pass

from config import ServiceConfig, config

def create_llm_service(cfg: Optional[ServiceConfig] = None):
    """Create LLM service based on configuration"""
    if cfg is None:
        cfg = config
    
    # Check if local Ollama is requested via environment variable
    use_ollama = os.getenv("USE_LOCAL_OLLAMA", "true").lower() == "true"
    
    if use_ollama:
        logger.info("Creating Local Ollama LLM service: llama3.2:1b")
        # Ollama supports the OpenAI API format natively at /v1
        return OpenAILLMService(
            api_key="ollama", # dummy key
            base_url="http://host.docker.internal:11434/v1",
            model="llama3.2:1b",
            temperature=cfg.llm.temperature,
            max_tokens=cfg.llm.max_tokens
        )
    elif cfg.llm.provider == "openai":
        logger.info(f"Creating OpenAI LLM service: {cfg.llm.model}")
        return OpenAILLMService(
            api_key=cfg.llm.api_key,
            model=cfg.llm.model,
            temperature=cfg.llm.temperature,
            max_tokens=cfg.llm.max_tokens
        )
    else:
        raise ValueError(f"Unsupported LLM provider: {cfg.llm.provider}")


def create_tts_service(cfg: Optional[ServiceConfig] = None):
    """Create TTS service based on configuration"""
    if cfg is None:
        cfg = config
    
    use_local_tts = os.getenv("USE_LOCAL_TTS", "true").lower() == "true"
    
    if use_local_tts:
        logger.info("Creating Custom Local XTTS-v2 Service for Zero-Shot Tamil Voice Cloning")
        return CustomLocalTTSService(
            api_url="http://host.docker.internal:8001/synthesize",
            language="en"
        )
    elif cfg.tts.provider == "openai":
        logger.info(f"Creating OpenAI TTS service: {cfg.tts.voice}")
        return OpenAITTSService(
            api_key=cfg.tts.api_key,
            voice=cfg.tts.voice,
            model=cfg.tts.model
        )
    else:
        raise ValueError(f"Unsupported TTS provider: {cfg.tts.provider}")


def create_stt_service(cfg: Optional[ServiceConfig] = None):
    """Create STT service based on configuration"""
    if cfg is None:
        cfg = config
    
    use_local_stt = os.getenv("USE_LOCAL_STT", "false").lower() == "true"
    
    if use_local_stt:
        logger.info("Creating Local Faster-Whisper STT service")
        # Requires: pip install pipecat-ai[faster-whisper]
        try:
            from pipecat.services.faster_whisper import FasterWhisperSTTService
            return FasterWhisperSTTService(
                model="base",
                language="ta"
            )
        except ImportError:
            logger.error("faster-whisper not installed. Falling back to Deepgram.")
            # Fall back below
            
    logger.info(f"Creating STT service: {cfg.stt.provider} - {cfg.stt.model}")
    if cfg.stt.provider == "deepgram":
        return DeepgramSTTService(
            api_key=cfg.stt.api_key,
            model=cfg.stt.model,
            language=cfg.stt.language
        )
    else:
        raise ValueError(f"Unsupported STT provider: {cfg.stt.provider}")

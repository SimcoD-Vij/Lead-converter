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


def create_llm_service(cfg: Optional[ServiceConfig] = None):
    """Create LLM service based on configuration"""
    if cfg is None:
        cfg = config
    
    logger.info(f"Creating LLM service: {cfg.llm.provider} - {cfg.llm.model}")
    
    if cfg.llm.provider == "openai":
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
    
    logger.info(f"Creating TTS service: {cfg.tts.provider} - {cfg.tts.voice}")
    
    if cfg.tts.provider == "openai":
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
    
    logger.info(f"Creating STT service: {cfg.stt.provider} - {cfg.stt.model}")
    
    if cfg.stt.provider == "deepgram":
        return DeepgramSTTService(
            api_key=cfg.stt.api_key,
            model=cfg.stt.model,
            language=cfg.stt.language
        )
    else:
        raise ValueError(f"Unsupported STT provider: {cfg.stt.provider}")

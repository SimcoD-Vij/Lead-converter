#!/usr/bin/env python3
"""
Test script for AI Agent Service
Run this to verify the service is working correctly
"""
import asyncio
import sys
from loguru import logger

# Add parent directory to path
sys.path.insert(0, '.')

from config import config
from service_factory import create_llm_service, create_tts_service, create_stt_service
from workflow_manager import WorkflowGraph
from pipecat_engine import SimplePipecatEngine


async def test_service_creation():
    """Test creating AI services"""
    logger.info("Testing service creation...")
    
    try:
        llm = create_llm_service()
        logger.success(f"✓ LLM service created: {config.llm.provider}/{config.llm.model}")
    except Exception as e:
        logger.error(f"✗ LLM service failed: {e}")
        return False
    
    try:
        tts = create_tts_service()
        logger.success(f"✓ TTS service created: {config.tts.provider}/{config.tts.voice}")
    except Exception as e:
        logger.error(f"✗ TTS service failed: {e}")
        return False
    
    try:
        stt = create_stt_service()
        logger.success(f"✓ STT service created: {config.stt.provider}/{config.stt.model}")
    except Exception as e:
        logger.error(f"✗ STT service failed: {e}")
        return False
    
    return True


async def test_workflow_creation():
    """Test creating workflow"""
    logger.info("Testing workflow creation...")
    
    try:
        workflow = WorkflowGraph.create_sales_workflow()
        logger.success(f"✓ Workflow created with {len(workflow.nodes)} nodes")
        logger.info(f"  Start node: {workflow.start_node_id}")
        
        # List all nodes
        for node_id, node in workflow.nodes.items():
            logger.info(f"  - {node.name} ({node_id}): {len(node.out_edges)} transitions")
        
        return True
    except Exception as e:
        logger.error(f"✗ Workflow creation failed: {e}")
        return False


async def test_engine_initialization():
    """Test engine initialization"""
    logger.info("Testing engine initialization...")
    
    try:
        # Create services
        llm = create_llm_service()
        workflow = WorkflowGraph.create_sales_workflow()
        
        # Create engine
        engine = SimplePipecatEngine(
            llm=llm,
            workflow=workflow,
            call_context_vars={"phone_number": "+1234567890", "caller_name": "Test User"},
            call_id="test-123"
        )
        
        logger.success("✓ Engine created")
        
        # Initialize engine
        await engine.initialize()
        logger.success(f"✓ Engine initialized at node: {engine._current_node.name}")
        
        # Test node transition
        logger.info("Testing node transition...")
        await engine.set_node("qualification")
        logger.success(f"✓ Transitioned to: {engine._current_node.name}")
        
        # Get gathered context
        context = engine.get_gathered_context()
        logger.info(f"  Gathered context: {context}")
        
        return True
    except Exception as e:
        logger.error(f"✗ Engine initialization failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_configuration():
    """Test configuration loading"""
    logger.info("Testing configuration...")
    
    logger.info(f"  Host: {config.host}")
    logger.info(f"  Port: {config.port}")
    logger.info(f"  Debug: {config.debug}")
    logger.info(f"  LLM: {config.llm.provider}/{config.llm.model}")
    logger.info(f"  TTS: {config.tts.provider}/{config.tts.voice}")
    logger.info(f"  STT: {config.stt.provider}/{config.stt.model}")
    
    # Check for API keys
    if not config.llm.api_key or config.llm.api_key == "your_openai_api_key_here":
        logger.warning("⚠ OpenAI API key not set!")
        return False
    
    if not config.stt.api_key or config.stt.api_key == "your_deepgram_api_key_here":
        logger.warning("⚠ Deepgram API key not set!")
        return False
    
    logger.success("✓ Configuration loaded")
    return True


async def main():
    """Run all tests"""
    logger.info("=" * 60)
    logger.info("AI Agent Service Test Suite")
    logger.info("=" * 60)
    
    results = []
    
    # Test configuration
    results.append(("Configuration", await test_configuration()))
    
    # Test service creation
    results.append(("Service Creation", await test_service_creation()))
    
    # Test workflow
    results.append(("Workflow Creation", await test_workflow_creation()))
    
    # Test engine
    results.append(("Engine Initialization", await test_engine_initialization()))
    
    # Print summary
    logger.info("=" * 60)
    logger.info("Test Summary")
    logger.info("=" * 60)
    
    all_passed = True
    for test_name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        logger.info(f"{status}: {test_name}")
        if not passed:
            all_passed = False
    
    logger.info("=" * 60)
    
    if all_passed:
        logger.success("All tests passed! ✓")
        return 0
    else:
        logger.error("Some tests failed! ✗")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

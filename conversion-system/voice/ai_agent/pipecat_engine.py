"""
Simplified Pipecat Engine for Voice AI Conversations
Adapted from Dograh's PipecatEngine with focus on sales conversations
"""
from typing import Optional, Callable, Awaitable, Dict, Any
from loguru import logger
import asyncio

from pipecat.frames.frames import EndFrame, CancelFrame
from pipecat.pipeline.task import PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.services.llm_service import FunctionCallParams

from workflow_manager import WorkflowGraph, WorkflowNode, get_function_schema


class SimplePipecatEngine:
    """
    Simplified AI conversation engine managing workflow transitions
    """
    
    def __init__(
        self,
        llm,
        workflow: WorkflowGraph,
        call_context_vars: dict,
        call_id: str
    ):
        self.llm = llm
        self.workflow = workflow
        self._call_context_vars = call_context_vars
        self._call_id = call_id
        
        self.task: Optional[PipelineTask] = None
        self.context: Optional[LLMContext] = None
        
        self._current_node: Optional[WorkflowNode] = None
        self._gathered_context: Dict[str, Any] = {}
        self._initialized = False
        self._call_ended = False
        
        logger.info(f"[{call_id}] Engine initialized with workflow: {workflow.start_node_id}")
    
    async def initialize(self):
        """Initialize the engine and set starting node"""
        if self._initialized:
            logger.warning(f"[{self._call_id}] Engine already initialized")
            return
        
        self._initialized = True
        
        # Set the starting node
        await self.set_node(self.workflow.start_node_id)
        
        logger.info(f"[{self._call_id}] Engine initialized at node: {self.workflow.start_node_id}")
    
    async def set_node(self, node_id: str):
        """Transition to a new conversation node"""
        node = self.workflow.nodes[node_id]
        
        logger.info(f"[{self._call_id}] Transitioning to node: {node.name} (id: {node_id})")
        
        previous_node_name = self._current_node.name if self._current_node else None
        self._current_node = node
        
        # Setup LLM context for this node
        await self._setup_llm_context(node)
        
        # If this is an end node, prepare to end the call
        if node.is_end:
            logger.info(f"[{self._call_id}] Reached end node: {node.name}")
    
    async def _setup_llm_context(self, node: WorkflowNode):
        """Configure LLM context with prompts and transition functions"""
        
        # Register transition functions for outgoing edges
        if not node.is_end:
            for edge in node.out_edges:
                await self._register_transition_function(edge.function_name, edge.target, edge.condition)
        
        # Build system message and function schemas
        system_message, functions = self._compose_system_message_and_functions(node)
        
        # Update LLM context
        self._update_llm_context(system_message, functions)
    
    async def _register_transition_function(self, function_name: str, target_node_id: str, description: str):
        """Register a transition function with the LLM"""
        
        async def transition_func(params: FunctionCallParams):
            logger.info(f"[{self._call_id}] Function called: {function_name} -> {target_node_id}")
            
            # Extract variables if needed before transitioning
            if self._current_node.extraction_enabled:
                await self._extract_variables(self._current_node)
            
            # Transition to new node
            await self.set_node(target_node_id)
            
            # If we just transitioned to an end node, end the call
            if self._current_node.is_end:
                await self.end_call(reason=f"reached_{target_node_id}")
            
            # Return success result
            result = {"status": "success", "transitioned_to": target_node_id}
            await params.result_callback(result)
        
        # Register with LLM
        self.llm.register_function(function_name, transition_func)
        logger.debug(f"[{self._call_id}] Registered function: {function_name}")
    
    def _compose_system_message_and_functions(self, node: WorkflowNode) -> tuple:
        """Generate system message and function schemas for a node"""
        
        # Format the prompt with context variables
        formatted_prompt = self._format_prompt(node.prompt)
        
        system_message = {
            "role": "system",
            "content": formatted_prompt
        }
        
        # Build function schemas for transitions
        functions = []
        for edge in node.out_edges:
            schema = get_function_schema(
                edge.function_name,
                edge.condition
            )
            functions.append(schema)
        
        return system_message, functions
    
    def _format_prompt(self, prompt: str) -> str:
        """Format prompt with context variables"""
        # Simple template replacement
        formatted = prompt
        for key, value in self._call_context_vars.items():
            formatted = formatted.replace(f"{{{{{key}}}}}", str(value))
        
        # Add gathered context
        if self._gathered_context:
            context_str = "\n\nGathered Information:\n"
            for key, value in self._gathered_context.items():
                context_str += f"- {key}: {value}\n"
            formatted += context_str
        
        return formatted
    
    def _update_llm_context(self, system_message: dict, functions: list):
        """Update the LLM context with new system message and functions"""
        if not self.context:
            logger.warning(f"[{self._call_id}] No context available to update")
            return
        
        # Clear existing messages and set new system message
        self.context.messages = [system_message]
        
        # Set available functions
        self.context.tools = functions
        
        logger.debug(f"[{self._call_id}] Updated LLM context with {len(functions)} functions")
    
    async def _extract_variables(self, node: WorkflowNode):
        """Extract variables from conversation using LLM"""
        if not node.extraction_enabled or not node.extraction_variables:
            return
        
        logger.info(f"[{self._call_id}] Extracting variables: {node.extraction_variables}")
        
        # Build extraction prompt
        extraction_prompt = node.extraction_prompt or f"Extract the following information: {', '.join(node.extraction_variables)}"
        
        # Get conversation history
        conversation_text = self._get_conversation_history()
        
        # Call LLM for extraction (simplified - in production use structured output)
        try:
            # This is a simplified version - real implementation would use LLM
            # For now, just log that extraction would happen
            logger.debug(f"[{self._call_id}] Would extract from conversation: {conversation_text[:200]}...")
            
            # In production, you'd call the LLM here to extract structured data
            # For now, we'll just mark that extraction occurred
            for var in node.extraction_variables:
                if var not in self._gathered_context:
                    self._gathered_context[var] = "extracted_value"
        
        except Exception as e:
            logger.error(f"[{self._call_id}] Variable extraction failed: {e}")
    
    def _get_conversation_history(self) -> str:
        """Get conversation history as text"""
        if not self.context or not self.context.messages:
            return ""
        
        history = []
        for msg in self.context.messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            history.append(f"{role}: {content}")
        
        return "\n".join(history)
    
    async def end_call(self, reason: str = "completed"):
        """End the call gracefully"""
        if self._call_ended:
            logger.debug(f"[{self._call_id}] Call already ended")
            return
        
        self._call_ended = True
        
        logger.info(f"[{self._call_id}] Ending call. Reason: {reason}")
        
        # Store final disposition
        self._gathered_context["call_disposition"] = reason
        self._gathered_context["final_node"] = self._current_node.name if self._current_node else "unknown"
        
        # Queue end frame if task is available
        if self.task:
            await self.task.queue_frame(EndFrame())
    
    def set_context(self, context: LLMContext):
        """Set the LLM context"""
        self.context = context
    
    def set_task(self, task: PipelineTask):
        """Set the pipeline task"""
        self.task = task
    
    def get_gathered_context(self) -> dict:
        """Get all gathered context data"""
        return self._gathered_context.copy()

"""
Workflow Manager - Defines conversation flow and stages
Adapted from Dograh's workflow system for sales conversations
"""
from typing import Dict, List, Optional
from pydantic import BaseModel
from loguru import logger


class WorkflowEdge(BaseModel):
    """Represents a transition between workflow nodes"""
    source: str
    target: str
    condition: str  # Description of when this transition should occur
    function_name: str  # LLM function call name for this transition
    
    def get_function_name(self) -> str:
        return self.function_name


class WorkflowNode(BaseModel):
    """Represents a conversation stage/node in the workflow"""
    id: str
    name: str
    prompt: str
    is_start: bool = False
    is_end: bool = False
    allow_interrupt: bool = True
    out_edges: List[WorkflowEdge] = []
    
    # Variable extraction configuration
    extraction_enabled: bool = False
    extraction_variables: List[str] = []
    extraction_prompt: str = ""


class WorkflowGraph:
    """Manages the conversation workflow graph"""
    
    def __init__(self, nodes: Dict[str, WorkflowNode], start_node_id: str):
        self.nodes = nodes
        self.start_node_id = start_node_id
        self.global_node_id: Optional[str] = None
        
    @classmethod
    def create_sales_workflow(cls) -> "WorkflowGraph":
        """Create a sales conversation workflow"""
        
        # Define workflow nodes
        nodes = {
            "greeting": WorkflowNode(
                id="greeting",
                name="Greeting",
                is_start=True,
                allow_interrupt=False,
                prompt="""You are a professional sales representative for a company.
Your goal is to greet the customer warmly and understand their needs.

Start by introducing yourself and asking how you can help them today.
Be friendly, professional, and concise.

Once you understand their initial need, transition to qualification.""",
                out_edges=[
                    WorkflowEdge(
                        source="greeting",
                        target="qualification",
                        condition="Customer has responded and you're ready to qualify them",
                        function_name="move_to_qualification"
                    )
                ]
            ),
            
            "qualification": WorkflowNode(
                id="qualification",
                name="Qualification",
                prompt="""You are now in the qualification stage.
Your goal is to understand:
1. The customer's name and company
2. Their specific pain points or challenges
3. Their budget range
4. Their timeline for making a decision

Ask relevant questions to gather this information naturally.
Don't interrogate - make it conversational.

Extract variables: customer_name, company_name, pain_points, budget_range, timeline

Once you have enough information, transition to the pitch.""",
                extraction_enabled=True,
                extraction_variables=["customer_name", "company_name", "pain_points", "budget_range", "timeline"],
                extraction_prompt="Extract the customer's name, company, pain points, budget range, and timeline from the conversation.",
                out_edges=[
                    WorkflowEdge(
                        source="qualification",
                        target="pitch",
                        condition="You have gathered enough qualification information",
                        function_name="move_to_pitch"
                    ),
                    WorkflowEdge(
                        source="qualification",
                        target="disqualified",
                        condition="Customer is clearly not a good fit (no budget, no authority, no need)",
                        function_name="mark_as_disqualified"
                    )
                ]
            ),
            
            "pitch": WorkflowNode(
                id="pitch",
                name="Product Pitch",
                prompt="""You are now presenting your solution.
Based on the customer's pain points and needs, explain how your product/service can help.

Be specific about:
1. How it addresses their pain points
2. Key benefits relevant to their situation
3. Success stories or examples

Keep it concise and focused on their needs.

After presenting, ask if they have any questions or concerns.""",
                out_edges=[
                    WorkflowEdge(
                        source="pitch",
                        target="objection_handling",
                        condition="Customer has raised objections or concerns",
                        function_name="handle_objections"
                    ),
                    WorkflowEdge(
                        source="pitch",
                        target="closing",
                        condition="Customer seems interested and ready to move forward",
                        function_name="move_to_closing"
                    )
                ]
            ),
            
            "objection_handling": WorkflowNode(
                id="objection_handling",
                name="Objection Handling",
                prompt="""The customer has raised objections or concerns.
Your goal is to address them professionally and empathetically.

Common objections:
- Price concerns: Emphasize ROI and value
- Timing: Understand their timeline and offer flexibility
- Competition: Highlight unique differentiators
- Authority: Identify decision-makers

After addressing objections, gauge their interest level.""",
                out_edges=[
                    WorkflowEdge(
                        source="objection_handling",
                        target="closing",
                        condition="Objections have been addressed and customer is ready to proceed",
                        function_name="move_to_closing"
                    ),
                    WorkflowEdge(
                        source="objection_handling",
                        target="follow_up",
                        condition="Customer needs more time or information",
                        function_name="schedule_follow_up"
                    )
                ]
            ),
            
            "closing": WorkflowNode(
                id="closing",
                name="Closing",
                prompt="""You are now in the closing stage.
The customer has shown interest. Your goal is to secure next steps.

Possible next steps:
1. Schedule a demo or detailed presentation
2. Send a proposal or quote
3. Set up a meeting with decision-makers
4. Close the sale if they're ready

Be clear about what happens next and get commitment on a specific action.""",
                out_edges=[
                    WorkflowEdge(
                        source="closing",
                        target="qualified",
                        condition="Customer has committed to next steps (demo, proposal, meeting, or purchase)",
                        function_name="mark_as_qualified"
                    ),
                    WorkflowEdge(
                        source="closing",
                        target="follow_up",
                        condition="Customer needs more time to decide",
                        function_name="schedule_follow_up"
                    )
                ]
            ),
            
            "follow_up": WorkflowNode(
                id="follow_up",
                name="Follow-up Scheduled",
                is_end=True,
                prompt="""Thank the customer for their time.
Confirm the follow-up details (when you'll contact them, what information you'll send).
End the call professionally and warmly.""",
                extraction_enabled=True,
                extraction_variables=["follow_up_date", "follow_up_action"],
                extraction_prompt="Extract the follow-up date and action items from the conversation.",
                out_edges=[]
            ),
            
            "qualified": WorkflowNode(
                id="qualified",
                name="Qualified Lead",
                is_end=True,
                prompt="""Congratulate the customer on their decision.
Confirm the next steps and timeline.
Thank them for their time and express enthusiasm about working together.
End the call professionally.""",
                out_edges=[]
            ),
            
            "disqualified": WorkflowNode(
                id="disqualified",
                name="Disqualified Lead",
                is_end=True,
                prompt="""Thank the customer for their time.
Let them know you appreciate the conversation.
Offer to stay in touch if their situation changes.
End the call professionally and politely.""",
                out_edges=[]
            )
        }
        
        return cls(nodes=nodes, start_node_id="greeting")


def get_function_schema(function_name: str, description: str, properties: dict = None, required: list = None) -> dict:
    """Generate OpenAI function schema"""
    schema = {
        "type": "function",
        "function": {
            "name": function_name,
            "description": description,
        }
    }
    
    if properties or required:
        schema["function"]["parameters"] = {
            "type": "object",
            "properties": properties or {},
            "required": required or []
        }
    
    return schema

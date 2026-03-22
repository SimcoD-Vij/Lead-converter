# ---------------------------------------------------------
# router_extra.py
# Sales Routing System - replaces router/router.js
# ---------------------------------------------------------
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from core.config import LEADS_FILE
from core.file_io import read_json, write_json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ROUTER")

# MOCK SALES TEAM
SALES_AGENTS = ["Tony", "Sai", "CR7"]

def _generate_summary(lead: dict, owner: str, priority: str) -> str:
    """Generate notification message."""
    response_digit = lead.get('last_response_digit')
    action_str = f"Pressed {response_digit}" if response_digit else "Passive"
    
    return f"""
    =========================================
    {priority} LEAD NOTIFICATION
    =========================================
    👤 Lead:   {lead.get('name')}
    🏢 Comp:   {lead.get('company')}
    📞 Phone:  {lead.get('phone')}
    -----------------------------------------
    🏆 Score:  {lead.get('score')} ({lead.get('category')})
    💬 Action: {action_str}
    📊 Status: {lead.get('status')}
    -----------------------------------------
    👉 ASSIGNED TO: @{owner}
    =========================================
    """

def run_routing() -> None:
    """Execute lead routing logic."""
    logger.info("🚀 Starting Smart Sales Routing...")

    leads: list[dict] = read_json(LEADS_FILE, fallback=[])
    if not leads:
        logger.warning("❌ No leads found or file missing.")
        return

    # 1. FILTER: Warm/Hot leads NOT yet routed
    qualified_leads = [
        l for l in leads 
        if l.get('score', 0) >= 20 and l.get('status') != "ROUTED_TO_SALES"
    ]

    # 2. ACCURACY UPGRADE: SORTING
    # Process the HOTTEST leads first (Score High -> Low)
    qualified_leads.sort(key=lambda l: l.get('score', 0), reverse=True)

    logger.info(f"📋 Found {len(qualified_leads)} qualified leads pending routing.")

    if not qualified_leads:
        return

    # 3. ROUTING LOOP
    for index, lead in enumerate(qualified_leads):
        # A. Assign Owner
        owner = SALES_AGENTS[index % len(SALES_AGENTS)]

        # B. Determine Urgency
        priority = "🔔 STANDARD"
        if lead.get('score', 0) >= 50 or lead.get('status') == "INTERESTED" or lead.get('last_reply'):
            priority = "🚨 URGENT"

        # C. Generate Alert
        alert_message = _generate_summary(lead, owner, priority)

        # D. Send Notification
        print(alert_message)

        # E. Update Database
        lead['owner'] = owner
        lead['status'] = "ROUTED_TO_SALES"
        lead['routed_at'] = datetime.now(timezone.utc).isoformat()

    # 4. SAVE CHANGES
    write_json(LEADS_FILE, leads)
    logger.info("💾 Database updated. High priority leads assigned first.")

if __name__ == "__main__":
    run_routing()

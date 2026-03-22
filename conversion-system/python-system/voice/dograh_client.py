# ---------------------------------------------------------
# voice/dograh_client.py
# Dograh AI Platform client - replaces voice/dograh_client.js
# ---------------------------------------------------------
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import httpx

from core.config import (
    DOGRAH_API_KEY,
    DOGRAH_API_URL,
    DOGRAH_WORKFLOW_ID,
    MINIO_ACCESS_KEY,
    MINIO_BUCKET,
    MINIO_ENDPOINT,
    MINIO_PORT,
    MINIO_SECRET_KEY,
    MINIO_USE_SSL,
)


class DograhClient:
    """
    HTTP client for the Dograh AI Platform.
    Equivalent to DograhClient class in voice/dograh_client.js
    """

    def __init__(
        self,
        api_url: str = DOGRAH_API_URL,
        api_key: str = DOGRAH_API_KEY,
    ):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.base_url = f"{self.api_url}/api/v1"

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            masked = self.api_key[:5] + "..." + self.api_key[-5:]
            print(f"[Dograh] Auth Header: X-API-Key={masked}")
            headers["X-API-Key"] = self.api_key.strip()
        return headers

    async def health_check(self) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{self.api_url}/api/v1/health")
            return r.json()

    async def create_workflow(self, config: dict) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{self.base_url}/workflows", json=config, headers=self._headers())
        print(f"[Dograh] Workflow created: {r.json().get('id')}")
        return r.json()

    async def get_workflow(self, workflow_id: str) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{self.base_url}/workflows/{workflow_id}", headers=self._headers())
        return r.json()

    async def list_workflows(self) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{self.base_url}/workflows", headers=self._headers())
        return r.json()

    async def initiate_call(
        self,
        trigger_uuid: str,
        phone_number: str,
        context: dict | None = None,
    ) -> dict[str, Any]:
        """
        Initiates a voice call via Dograh.
        Equivalent to initiateCall() in dograh_client.js
        """
        context = context or {}
        workflow_id = DOGRAH_WORKFLOW_ID

        if workflow_id:
            print(f"[Dograh] Initiating call to {phone_number} via Workflow ID {workflow_id}...")
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(
                    f"{self.base_url}/telephony/initiate-call",
                    json={"workflow_id": int(workflow_id), "phone_number": phone_number},
                    headers=self._headers(),
                )
            data = r.json()
            print(f"[Dograh] Call initiation message: {data.get('message')}")

            # Try to fetch the resulting run ID
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    runs_r = await client.get(
                        f"{self.base_url}/workflow/{workflow_id}/runs",
                        headers=self._headers(),
                    )
                runs = runs_r.json().get("runs", [])
                latest = runs[0] if runs else None
                if latest:
                    print(f"[Dograh] Identified Run ID: {latest['id']} ({latest.get('name')})")
                    return {"call_id": latest["id"], **latest}
            except Exception as e:
                print(f"[Dograh] Failed to fetch run ID: {e}")

            return {"call_id": str(data.get("message", "")).split()[-1] or "unknown", **data}

        # Fallback: public trigger UUID method
        print(f"[Dograh] Initiating call to {phone_number} with trigger {trigger_uuid}")
        payload = {"phone_number": phone_number, "initial_context": context}
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{self.base_url}/public/agent/{trigger_uuid}",
                json=payload,
                headers=self._headers(),
            )
        data = r.json()
        print("[Dograh] Call initiated successfully")
        return {"call_id": data.get("workflow_run_id"), **data}

    async def get_call_status(self, workflow_run_id: str, workflow_id: str) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{self.base_url}/workflow/{workflow_id}/runs/{workflow_run_id}",
                headers=self._headers(),
            )
        run = r.json()
        return {
            "status": "completed" if run.get("is_completed") else run.get("status", "in-progress"),
            "duration": (run.get("cost_info") or {}).get("call_duration_seconds", 0),
            "workflow_run_id": run.get("id"),
            **run,
        }

    async def get_call_transcript(self, workflow_run_id: str, workflow_id: str) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{self.base_url}/workflow/{workflow_id}/runs/{workflow_run_id}",
                headers=self._headers(),
            )
        run = r.json()
        transcript = ""
        messages = []
        logs = run.get("logs") or {}
        if logs.get("transcript"):
            transcript = logs["transcript"]
        if logs.get("messages"):
            messages = logs["messages"]

        return {
            "transcript": transcript or "No transcript available",
            "summary": logs.get("summary", ""),
            "messages": messages,
        }

    async def get_call_variables(self, workflow_run_id: str, workflow_id: str) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{self.base_url}/workflow/{workflow_id}/runs/{workflow_run_id}",
                headers=self._headers(),
            )
        run = r.json()
        return run.get("gathered_context") or run.get("initial_context") or {}

    async def wait_for_call_completion(
        self,
        call_id: str,
        workflow_id: str,
        max_wait_ms: int = 600_000,
    ) -> dict[str, Any]:
        """
        Polls call status until terminal state or timeout.
        Equivalent to waitForCallCompletion() in dograh_client.js
        """
        import time

        start = time.time()
        poll_interval = 5  # seconds

        while (time.time() - start) * 1000 < max_wait_ms:
            try:
                status = await self.get_call_status(call_id, workflow_id)
                terminal = {"completed", "failed", "no-answer", "busy"}
                if status.get("is_completed") or status.get("status") in terminal:
                    print(f"[Dograh] Call {call_id} completed with status: {status.get('status')}")

                    transcript, variables = await asyncio.gather(
                        self.get_call_transcript(call_id, workflow_id),
                        self.get_call_variables(call_id, workflow_id),
                        return_exceptions=True,
                    )
                    if isinstance(transcript, Exception):
                        transcript = None
                    if isinstance(variables, Exception):
                        variables = None

                    return {
                        "status": status.get("status"),
                        "transcript": transcript,
                        "variables": variables,
                        "duration": status.get("duration"),
                        "call_id": call_id,
                    }
            except Exception as error:
                print(f"[Dograh] Error polling call status: {error}")

            await asyncio.sleep(poll_interval)

        raise TimeoutError(f"Call {call_id} did not complete within {max_wait_ms}ms")

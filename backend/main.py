import asyncio
import json
import os
import queue as q
import threading
from pathlib import Path
from typing import Optional

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent import run_campaign_agent
from data_loader import load_publishers, load_personas, get_metadata

load_dotenv(Path(__file__).parent.parent / ".env.local")

app = FastAPI(title="Disco Campaign Builder API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# Pre-load data at startup
load_publishers()
load_personas()


class CampaignRequest(BaseModel):
    advertiser_description: str
    clarification: Optional[str] = None
    api_key: Optional[str] = None


class ValidateKeyRequest(BaseModel):
    api_key: str


# ── Streaming endpoint (primary) ──────────────────────────────────────────────

@app.post("/validate-key")
async def validate_key(req: ValidateKeyRequest):
    """
    Tests an Anthropic API key by making a minimal API call.
    Returns {valid: true} on success or raises 400 with the error message.
    """
    key = req.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="api_key is required")
    try:
        client = anthropic.Anthropic(api_key=key)
        client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1,
            messages=[{"role": "user", "content": "hi"}],
        )
        return {"valid": True}
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=400, detail="Invalid API key — authentication failed")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/campaign/stream")
async def stream_campaign(req: CampaignRequest):
    """
    SSE endpoint. Streams agent progress events followed by the final result.
    Each event: data: {json}\\n\\n
    """
    api_key = req.api_key.strip() if req.api_key else os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="No API key provided. Set one in the UI or in .env.local")
    if not req.advertiser_description.strip():
        raise HTTPException(status_code=400, detail="advertiser_description is required")

    event_queue: q.Queue = q.Queue()

    def run_agent_thread():
        try:
            for event in run_campaign_agent(req.advertiser_description, req.clarification, api_key):
                event_queue.put(event)
        except Exception as exc:
            event_queue.put({"type": "error", "message": str(exc)})
        finally:
            event_queue.put(None)  # sentinel

    thread = threading.Thread(target=run_agent_thread, daemon=True)
    thread.start()

    async def event_generator():
        while True:
            try:
                event = event_queue.get_nowait()
            except q.Empty:
                await asyncio.sleep(0.05)
                continue
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── Metadata endpoint (useful for debugging / demo) ───────────────────────────

@app.get("/metadata")
async def dataset_metadata():
    """Returns the metadata summary the LLM sees on its first turn."""
    pub_meta, persona_meta = get_metadata()
    return {"publishers": pub_meta, "personas": persona_meta}


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": "claude-sonnet-4-6"}

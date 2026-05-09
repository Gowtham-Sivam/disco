"""
Agentic campaign generation loop.

Flow:
  1. Feed LLM only dataset metadata (schema + 2 sample rows)
  2. LLM calls query_data → we run pandas → return compact results
  3. Repeat up to MAX_QUERY_ITERATIONS
  4. If LLM calls ask_clarification → stream question back, stop loop
  5. When LLM calls generate_campaign → stream final result, done
  6. If max iterations hit → force generate_campaign call

All events are yielded as dicts for the SSE layer to serialize.
"""

import json
import anthropic
from typing import Generator

from data_loader import get_metadata, execute_query
from prompt import (
    build_system_prompt,
    build_agent_user_prompt,
    QUERY_DATA_TOOL,
    ASK_CLARIFICATION_TOOL,
    CAMPAIGN_TOOL_SCHEMA,
)

MAX_QUERY_ITERATIONS = 5
ALL_TOOLS = [QUERY_DATA_TOOL, ASK_CLARIFICATION_TOOL, CAMPAIGN_TOOL_SCHEMA]


def run_campaign_agent(description: str, clarification: str | None = None) -> Generator[dict, None, None]:
    client = anthropic.Anthropic()

    # ── Phase 1: load metadata ────────────────────────────────────────────────
    yield {"type": "metadata_loading", "message": "Loading dataset metadata..."}
    pub_meta, persona_meta = get_metadata()
    yield {
        "type": "metadata_loaded",
        "message": f"Loaded {pub_meta['total_records']} publishers · {persona_meta['total_records']} personas",
        "publishers_meta": pub_meta,
        "personas_meta": persona_meta,
    }

    # ── Phase 2: build initial messages ──────────────────────────────────────
    user_content = build_agent_user_prompt(description, pub_meta, persona_meta, clarification)
    messages = [{"role": "user", "content": user_content}]

    yield {"type": "agent_start", "message": "Analyzing advertiser description..."}

    query_count = 0

    # ── Phase 3: agent loop ───────────────────────────────────────────────────
    while query_count < MAX_QUERY_ITERATIONS:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            system=build_system_prompt(),
            tools=ALL_TOOLS,
            messages=messages,
        )

        tool_calls = [b for b in response.content if b.type == "tool_use"]

        if not tool_calls:
            yield {"type": "error", "message": "Agent returned no tool call. Please try again."}
            return

        tool_results = []
        stop_loop = False

        for tc in tool_calls:
            # ── Final answer ──────────────────────────────────────────────────
            if tc.name == "generate_campaign":
                yield {"type": "generating_campaign", "message": "Building final campaign plan..."}
                yield {"type": "complete", "result": tc.input}
                return

            # ── Needs user input ──────────────────────────────────────────────
            if tc.name == "ask_clarification":
                yield {
                    "type": "clarification_needed",
                    "question": tc.input["question"],
                    "reason": tc.input.get("reason", ""),
                }
                stop_loop = True
                break

            # ── Data query ────────────────────────────────────────────────────
            if tc.name == "query_data":
                query_count += 1
                yield {
                    "type": "query_planned",
                    "iteration": query_count,
                    "reasoning": tc.input["reasoning"],
                    "code": tc.input["code"],
                }
                try:
                    result = execute_query(tc.input["code"])
                    yield {
                        "type": "query_executed",
                        "iteration": query_count,
                        "result_count": result.get("count"),
                        "data": result,
                    }
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tc.id,
                        "content": json.dumps(result),
                    })
                except Exception as exc:
                    err = str(exc)
                    yield {"type": "query_error", "iteration": query_count, "error": err}
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tc.id,
                        "content": json.dumps({"error": err}),
                        "is_error": True,
                    })

        if stop_loop:
            return

        if not tool_results:
            break

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})

    # ── Phase 4: force final answer after hitting query limit ─────────────────
    yield {"type": "generating_campaign", "message": "Query limit reached — generating final answer..."}
    messages.append({"role": "user", "content": "You've gathered enough data. Call generate_campaign now."})

    final = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        system=build_system_prompt(),
        tools=[CAMPAIGN_TOOL_SCHEMA],
        tool_choice={"type": "tool", "name": "generate_campaign"},
        messages=messages,
    )

    tc = next((b for b in final.content if b.type == "tool_use"), None)
    if tc:
        yield {"type": "complete", "result": tc.input}
    else:
        yield {"type": "error", "message": "Failed to generate final campaign."}

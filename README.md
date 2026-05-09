# Disco Campaign Builder

An AI-powered ad campaign planning tool: describe your business, get ranked publisher recommendations, tailored ad creative, and a structured campaign config — all with visible reasoning.

## How to run

```bash
# 1. Add your API key
cp .env.local.example .env.local
# edit .env.local and set ANTHROPIC_API_KEY

# 2. Backend (terminal 1)
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload          # http://localhost:8000

# 3. Frontend (terminal 2)
npm install
npm run dev                        # http://localhost:3000
```

**Quick commands** (after `source commands.sh` from project root):
`br` start backend · `bs` stop backend · `fr` start frontend · `fs` stop frontend

## What I built

A React/Next.js 15 frontend with a Python FastAPI backend. Instead of dumping the entire publisher catalog into the prompt, the backend uses an **agentic query loop**: Claude sees only dataset metadata (schema + 2 sample rows) on the first turn, then writes targeted pandas queries to fetch specific publisher and persona slices. Each query result is streamed back to Claude, which iterates until it has enough context to call generate_campaign (max 5 queries). The entire process streams to the frontend as SSE events, showing live progress and a Technical Details tab with every query, code, and result.

## Prompt design

Three tools: `query_data` (pandas eval against publishers/personas DataFrames), `ask_clarification` (optional one-time user question), and `generate_campaign` (final structured output via `tool_choice`). The max-5-query guardrail prevents infinite loops. Full rationale in `prompts/campaign_generation.md`.

## Campaign config shape — and why

Fields: targeting (age, gender, income, geo, interests, behavioral signals), budget (daily + total + duration + per-publisher allocation with bid type and bid), bid strategy (type + rationale + range), optimization priority, KPIs. Excluded fields a real system derives automatically (frequency caps, dayparting, creative rotation) — those are operational, not strategic.

## What I'd do next

Anthropic prompt caching on the static metadata context (same every request — ~80% latency/cost reduction). Streaming partial results so the publisher list appears before the creative is done. A proper publisher database with live inventory. Replace hand-written personas with model-inferred segments from first-party purchase signals. Feedback loop: feed CTR/CPA data back to improve publisher scoring.

## What I intentionally cut

Image creative generation. Real auction simulation. User auth and campaign persistence. Multi-step refinement flows.

## Hard vs. easy

**Easy:** wiring SSE, rendering JSON, formatting the UI. **Genuinely hard (1):** Getting targeted queries instead of full data dumps required explicit prompt constraints ("do NOT fetch everything at once," "2–4 queries"). **Hard (2):** Creative copy that feels persona-specific — the prompt has to name "generic copy is a failure" and force Claude to reference messaging_preferences. **Hard (3):** Publisher exclusion — LLMs default to recommending everything; the prompt must explicitly say "not every publisher is a fit." **Real production hard:** cross-device audience matching, keeping publisher catalog data fresh, and building a performance feedback loop that tightens scoring over time.

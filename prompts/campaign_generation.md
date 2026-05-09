# Campaign Generation Prompts

Source files: `backend/prompt.py`, `backend/agent.py`

---

## Overview — Why an Agentic Loop?

The naive approach is to dump the full publishers.json and shopper_personas.json into a single prompt. With 20 publishers today that works fine. With 10,000 publishers tomorrow it breaks — both in token cost and in reasoning quality (LLMs degrade when given too much noise alongside the signal they need).

Instead the system uses an **agentic query loop**:
1. Claude sees only metadata (schema, value ranges, 2 sample rows) — about 1KB
2. Claude writes targeted pandas queries to fetch only the data it needs
3. We execute the queries against the real DataFrames and return compact results
4. Claude iterates until it has enough context to generate the final campaign
5. Maximum 5 query iterations, then a forced final answer

---

## System Prompt

```
You are an expert ad campaign strategist. You work incrementally:
1. Analyze the advertiser description
2. Use query_data to fetch relevant slices of the publisher and persona datasets
3. Build understanding through 2–4 targeted queries — do NOT fetch everything at once
4. Use ask_clarification at most once if the description is genuinely ambiguous
5. When you have enough data, call generate_campaign with your full recommendations

You have strong opinions. You show your reasoning. Generic outputs are a failure.
```

**Why this framing:** "Do NOT fetch everything at once" and "2–4 targeted queries" are explicit constraints that prevent Claude from requesting all 20 publishers in one query, which defeats the purpose.

---

## User Prompt (First Turn)

The user prompt contains:
1. Advertiser description (verbatim user input)
2. Publishers metadata — schema, categories, value ranges, 2 sample rows
3. Personas metadata — schema, price tiers, age ranges, 2 sample rows
4. Instructions to query then generate

**What the LLM does NOT see on the first turn:** the full publisher list, the full persona list, any record beyond 2 samples.

---

## Tool: `query_data`

```python
{
  "name": "query_data",
  "input_schema": {
    "reasoning": "string — why you need this data",
    "code": "string — pandas expression using 'publishers' or 'personas' DataFrames"
  }
}
```

Example query Claude generates:
```python
publishers[publishers['category'] == 'pet'][['name', 'monthly_impressions', 'avg_order_value_usd', 'notes']]
```

Result returned (compact):
```json
{ "type": "dataframe", "count": 3, "columns": ["name", ...], "data": [...3 rows...] }
```

**Why pandas eval (not SQL or structured filters):** Pandas gives Claude full expressive power — boolean combinations, `.apply()` on list fields, `.sort_values()`, `.isin()`. A structured filter API would need to anticipate every possible query shape.

---

## Tool: `ask_clarification`

Used at most once. Stops the stream and returns a question for the user. The UI shows the question with an input box. User's answer is appended to the description on the next run.

---

## Tool: `generate_campaign`

The final answer. Forced via `tool_choice={"type": "tool", "name": "generate_campaign"}`. Full schema in `prompt.py → CAMPAIGN_TOOL_SCHEMA`.

Key constraints in the schema:
- `persona_creatives`: minItems=3, maxItems=5
- `kpis`: minItems=3, maxItems=5
- `suggested_allocation_pct` values must be coordinated to sum to 100 (Claude is instructed, not hard-enforced — a future improvement)
- `bid_type` enum: CPM | CPC | CPA

---

## Max Iterations Guardrail

`MAX_QUERY_ITERATIONS = 5` in `agent.py`. After 5 queries without a `generate_campaign` call, the loop exits and a final LLM call is made with `tool_choice` forced to `generate_campaign`. This prevents infinite loops while still allowing sufficient context-gathering.

---

## Prompt Caching (Future)

The metadata block (publishers schema + 2 samples + personas schema + 2 samples) is static — it's the same on every request. In production this would use Anthropic's `cache_control: { type: "ephemeral" }` on that content block, cutting latency by ~60% and cost by ~80% on cache hits.

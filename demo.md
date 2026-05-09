# Disco Campaign Builder — API Reference

Base URL: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

---

## POST /campaign/stream

**Primary endpoint.** Streams Server-Sent Events (SSE) as the agent works — metadata load, pandas queries, and the final campaign result.

### Request
```json
{
  "advertiser_description": "We sell premium dog food for senior dogs, targeting owners who care about joint health. Grain-free, vet-formulated, subscription-based.",
  "clarification": null
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `advertiser_description` | string | ✅ | The advertiser's business description |
| `clarification` | string | ❌ | User's answer to a clarification question from a prior run |

### Response — SSE event stream

Each line is: `data: {json}\n\n`

**Event types in order:**

```jsonc
// 1. Data is being loaded
{ "type": "metadata_loading", "message": "Loading dataset metadata..." }

// 2. Metadata extracted — what the LLM sees first
{ "type": "metadata_loaded", "message": "Loaded 20 publishers · 10 personas",
  "publishers_meta": { "total_records": 20, "categories": [...], "impressions_range": {...}, ... },
  "personas_meta": { "total_records": 10, "price_sensitivities": [...], ... } }

// 3. Agent begins reasoning
{ "type": "agent_start", "message": "Analyzing advertiser description..." }

// 4. Agent decides to run a query
{ "type": "query_planned", "iteration": 1,
  "reasoning": "Need to find pet-category publishers with subscription subcategory",
  "code": "publishers[publishers['category'] == 'pet'][['name', 'monthly_impressions', 'avg_order_value_usd', 'notes']]" }

// 5. Query result returned
{ "type": "query_executed", "iteration": 1, "result_count": 3,
  "data": { "type": "dataframe", "count": 3, "columns": ["name", "monthly_impressions", ...], "data": [...] } }

// 6. (optional) Query had a pandas error
{ "type": "query_error", "iteration": 1, "error": "KeyError: 'bad_column'" }

// 7. (optional) Agent needs user input — stream stops here
{ "type": "clarification_needed",
  "question": "Is this product aimed at dogs specifically or all pets?",
  "reason": "This determines whether to include cat-focused publishers like Tailcrate" }

// 8. Agent is writing the final campaign
{ "type": "generating_campaign", "message": "Building final campaign plan..." }

// 9. Done — full campaign object
{ "type": "complete", "result": {
    "recommended_publishers": [ ... ],
    "excluded_publishers": [ ... ],
    "persona_creatives": [ ... ],
    "campaign_config": { ... },
    "input_quality_assessment": "Good. ..."
  }
}

// Error at any point
{ "type": "error", "message": "ANTHROPIC_API_KEY is not set" }
```

### curl example
```bash
curl -N -X POST http://localhost:8000/campaign/stream \
  -H "Content-Type: application/json" \
  -d '{"advertiser_description": "We sell premium dog food for senior dogs."}'
```

### With clarification
```bash
curl -N -X POST http://localhost:8000/campaign/stream \
  -H "Content-Type: application/json" \
  -d '{"advertiser_description": "We sell dog food.", "clarification": "Premium segment, subscription model, focused on senior dogs"}'
```

---

## GET /metadata

Returns the compact metadata summary the LLM sees on its first turn — useful for debugging what the agent starts with.

```bash
curl http://localhost:8000/metadata
```

**Response:**
```json
{
  "publishers": {
    "total_records": 20,
    "columns": ["id", "name", "category", ...],
    "categories": ["apparel", "beauty", "beverages", ...],
    "income_tiers": ["high", "mid", "mid-high"],
    "impressions_range": { "min": 2800000, "max": 84000000 },
    "aov_range_usd": { "min": 28, "max": 198 },
    "sample_records": [ ... 2 records ... ]
  },
  "personas": {
    "total_records": 10,
    "columns": ["id", "name", "age_range", ...],
    "price_sensitivities": ["high", "low", "low-medium", "medium", "medium-high"],
    "age_ranges": [ ... ],
    "sample_records": [ ... 2 records ... ]
  }
}
```

---

## GET /health

```bash
curl http://localhost:8000/health
# { "status": "ok", "model": "claude-sonnet-4-6" }
```

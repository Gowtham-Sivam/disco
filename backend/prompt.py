import json


# ─── Tool Definitions ────────────────────────────────────────────────────────

QUERY_DATA_TOOL = {
    "name": "query_data",
    "description": """Execute a pandas expression against the publisher or persona datasets.

Available variables:
  publishers  — pd.DataFrame of all publishers (fields use dot-notation for nested keys)
  personas    — pd.DataFrame of all shopper personas
  pd          — pandas module

The expression must be a single eval-able statement that returns a DataFrame, Series, or scalar.

Examples:
  publishers[publishers['category'] == 'pet'][['name', 'monthly_impressions', 'avg_order_value_usd', 'notes']]
  publishers[publishers['audience.income_tier'].isin(['high', 'mid-high'])].sort_values('monthly_impressions', ascending=False)[['name', 'category', 'monthly_impressions', 'notes']]
  publishers[publishers['subcategories'].apply(lambda x: 'subscription' in x)][['name', 'category', 'avg_order_value_usd']]
  personas[personas['price_sensitivity'].isin(['low', 'low-medium'])][['name', 'category_affinities', 'messaging_preferences', 'typical_aov_usd']]
  personas[personas['category_affinities'].apply(lambda x: 'pet_food' in x)][['name', 'description', 'messaging_preferences']]
""",
    "input_schema": {
        "type": "object",
        "properties": {
            "reasoning": {
                "type": "string",
                "description": "Why you need this data — what you're looking for and why",
            },
            "code": {
                "type": "string",
                "description": "Single pandas expression to evaluate",
            },
        },
        "required": ["reasoning", "code"],
    },
}

ASK_CLARIFICATION_TOOL = {
    "name": "ask_clarification",
    "description": (
        "Ask the user ONE specific clarifying question. "
        "Use only when the advertiser description is genuinely ambiguous "
        "in a way that would significantly change which publishers or personas are selected. "
        "Do NOT ask about budget — assume $500/day if unspecified. "
        "Do NOT ask if the product is premium — infer from the description."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "question": {"type": "string"},
            "reason": {"type": "string", "description": "Why this matters for campaign decisions"},
        },
        "required": ["question", "reason"],
    },
}

CAMPAIGN_TOOL_SCHEMA = {
    "name": "generate_campaign",
    "description": "Generate the final structured ad campaign plan. Call this when you have gathered enough data.",
    "input_schema": {
        "type": "object",
        "properties": {
            "recommended_publishers": {
                "type": "array",
                "description": "Publishers selected as a good fit, ranked best to worst",
                "items": {
                    "type": "object",
                    "properties": {
                        "publisher_id": {"type": "string"},
                        "publisher_name": {"type": "string"},
                        "rank": {"type": "integer", "minimum": 1},
                        "fit_score": {"type": "number", "minimum": 0, "maximum": 1},
                        "reasoning": {"type": "string"},
                        "key_signals": {"type": "array", "items": {"type": "string"}},
                        "suggested_allocation_pct": {"type": "number"},
                    },
                    "required": ["publisher_id", "publisher_name", "rank", "fit_score", "reasoning", "key_signals", "suggested_allocation_pct"],
                },
            },
            "excluded_publishers": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "publisher_id": {"type": "string"},
                        "publisher_name": {"type": "string"},
                        "exclusion_reason": {"type": "string"},
                    },
                    "required": ["publisher_id", "publisher_name", "exclusion_reason"],
                },
            },
            "persona_creatives": {
                "type": "array",
                "minItems": 3,
                "maxItems": 5,
                "items": {
                    "type": "object",
                    "properties": {
                        "persona_id": {"type": "string"},
                        "persona_name": {"type": "string"},
                        "persona_reasoning": {"type": "string"},
                        "relevance_score": {"type": "number", "minimum": 0, "maximum": 1},
                        "variants": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": 2,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "headline": {"type": "string"},
                                    "body_copy": {"type": "string"},
                                    "tone": {"type": "string"},
                                },
                                "required": ["headline", "body_copy", "tone"],
                            },
                        },
                    },
                    "required": ["persona_id", "persona_name", "persona_reasoning", "relevance_score", "variants"],
                },
            },
            "campaign_config": {
                "type": "object",
                "properties": {
                    "campaign_name": {"type": "string"},
                    "advertiser_summary": {"type": "string"},
                    "targeting": {
                        "type": "object",
                        "properties": {
                            "age_ranges": {"type": "array", "items": {"type": "string"}},
                            "gender_focus": {"type": "array", "items": {"type": "string"}},
                            "income_tiers": {"type": "array", "items": {"type": "string"}},
                            "geographic_focus": {"type": "array", "items": {"type": "string"}},
                            "category_interests": {"type": "array", "items": {"type": "string"}},
                            "behavioral_signals": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["age_ranges", "gender_focus", "income_tiers", "geographic_focus", "category_interests", "behavioral_signals"],
                    },
                    "budget": {
                        "type": "object",
                        "properties": {
                            "suggested_daily_budget_usd": {"type": "number"},
                            "suggested_total_budget_usd": {"type": "number"},
                            "suggested_duration_days": {"type": "integer"},
                            "publisher_allocation": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "publisher_id": {"type": "string"},
                                        "publisher_name": {"type": "string"},
                                        "allocation_pct": {"type": "number"},
                                        "suggested_daily_spend_usd": {"type": "number"},
                                        "bid_type": {"type": "string", "enum": ["CPM", "CPC", "CPA"]},
                                        "suggested_bid_usd": {"type": "number"},
                                        "rationale": {"type": "string"},
                                    },
                                    "required": ["publisher_id", "publisher_name", "allocation_pct", "suggested_daily_spend_usd", "bid_type", "suggested_bid_usd", "rationale"],
                                },
                            },
                        },
                        "required": ["suggested_daily_budget_usd", "suggested_total_budget_usd", "suggested_duration_days", "publisher_allocation"],
                    },
                    "bid_strategy": {
                        "type": "object",
                        "properties": {
                            "primary_type": {"type": "string", "enum": ["CPM", "CPC", "CPA"]},
                            "rationale": {"type": "string"},
                            "suggested_range_usd": {
                                "type": "object",
                                "properties": {"min": {"type": "number"}, "max": {"type": "number"}},
                                "required": ["min", "max"],
                            },
                        },
                        "required": ["primary_type", "rationale", "suggested_range_usd"],
                    },
                    "optimization_priority": {"type": "string", "enum": ["brand_awareness", "performance", "conversion"]},
                    "kpis": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 5},
                    "notes": {"type": "string"},
                },
                "required": ["campaign_name", "advertiser_summary", "targeting", "budget", "bid_strategy", "optimization_priority", "kpis", "notes"],
            },
            "input_quality_assessment": {"type": "string"},
        },
        "required": ["recommended_publishers", "excluded_publishers", "persona_creatives", "campaign_config", "input_quality_assessment"],
    },
}


# ─── Prompt Builders ─────────────────────────────────────────────────────────

def build_system_prompt() -> str:
    return (
        "You are an expert ad campaign strategist. You work incrementally:\n"
        "1. Analyze the advertiser description\n"
        "2. Use query_data to fetch relevant slices of the publisher and persona datasets\n"
        "3. Build understanding through 2–4 targeted queries — do NOT fetch everything at once\n"
        "4. Use ask_clarification at most once if the description is genuinely ambiguous\n"
        "5. When you have enough data, call generate_campaign with your full recommendations\n\n"
        "You have strong opinions. You show your reasoning. Generic outputs are a failure."
    )


def build_agent_user_prompt(description: str, pub_meta: dict, persona_meta: dict, clarification: str | None = None) -> str:
    clarification_block = f"\n## User Clarification\n{clarification}\n" if clarification else ""

    return f"""## Advertiser Description
{description}
{clarification_block}
## Available Datasets

### publishers DataFrame  ({pub_meta['total_records']} records)
Columns: {', '.join(pub_meta['columns'])}
Note: {pub_meta['note']}

Key ranges:
- categories: {', '.join(pub_meta['categories'])}
- audience.income_tier values: {', '.join(pub_meta['income_tiers'])}
- audience.age_skew values: {', '.join(pub_meta['age_skews'])}
- monthly_impressions: {pub_meta['impressions_range']['min']:,} – {pub_meta['impressions_range']['max']:,}
- avg_order_value_usd: ${pub_meta['aov_range_usd']['min']} – ${pub_meta['aov_range_usd']['max']}

Sample records (2 of {pub_meta['total_records']}):
{json.dumps(pub_meta['sample_records'], indent=2)}

### personas DataFrame  ({persona_meta['total_records']} records)
Columns: {', '.join(persona_meta['columns'])}
Note: {persona_meta['note']}

Key ranges:
- price_sensitivity values: {', '.join(persona_meta['price_sensitivities'])}
- age_range values: {', '.join(persona_meta['age_ranges'])}

Sample records (2 of {persona_meta['total_records']}):
{json.dumps(persona_meta['sample_records'], indent=2)}

---

Start by deciding what publisher categories and persona types fit this advertiser.
Then use query_data to fetch specific slices. After 2–4 queries you should have enough data.
Then call generate_campaign. Cover all excluded publishers in excluded_publishers."""

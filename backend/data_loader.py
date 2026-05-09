"""
Loads publisher and persona JSON files into pandas DataFrames.
Extracts compact metadata (schema, ranges, categories, 2 sample rows)
so the LLM gets enough context to write targeted queries without
seeing the full dataset.
"""

import json
import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

# Module-level cache — loaded once at startup
_publishers_df: pd.DataFrame | None = None
_publishers_raw: list | None = None
_personas_df: pd.DataFrame | None = None
_personas_raw: list | None = None


def load_publishers() -> tuple[pd.DataFrame, list]:
    global _publishers_df, _publishers_raw
    if _publishers_df is None:
        with open(DATA_DIR / "publishers.json") as f:
            _publishers_raw = json.load(f)
        # json_normalize flattens nested dicts → audience.income_tier, etc.
        _publishers_df = pd.json_normalize(_publishers_raw)
    return _publishers_df.copy(), _publishers_raw  # type: ignore


def load_personas() -> tuple[pd.DataFrame, list]:
    global _personas_df, _personas_raw
    if _personas_df is None:
        with open(DATA_DIR / "shopper_personas.json") as f:
            _personas_raw = json.load(f)
        _personas_df = pd.DataFrame(_personas_raw)
    return _personas_df.copy(), _personas_raw  # type: ignore


def get_metadata() -> tuple[dict, dict]:
    """
    Returns compact metadata dicts for publishers and personas.
    These are what the LLM sees on the first turn — not the full data.
    """
    pub_df, pub_raw = load_publishers()
    persona_df, persona_raw = load_personas()

    publishers_meta = {
        "total_records": len(pub_df),
        "columns": pub_df.columns.tolist(),
        "note": "Nested fields use dot notation e.g. audience.income_tier. List fields (subcategories, audience.top_geos) need .apply(lambda x: 'value' in x) to filter.",
        "categories": sorted(pub_df["category"].unique().tolist()),
        "income_tiers": sorted(pub_df["audience.income_tier"].unique().tolist()),
        "age_skews": sorted(pub_df["audience.age_skew"].unique().tolist()),
        "impressions_range": {
            "min": int(pub_df["monthly_impressions"].min()),
            "max": int(pub_df["monthly_impressions"].max()),
        },
        "aov_range_usd": {
            "min": int(pub_df["avg_order_value_usd"].min()),
            "max": int(pub_df["avg_order_value_usd"].max()),
        },
        "sample_records": pub_raw[:2],
    }

    personas_meta = {
        "total_records": len(persona_df),
        "columns": persona_df.columns.tolist(),
        "note": "List fields (category_affinities, messaging_preferences, disinterested_in) need .apply(lambda x: 'value' in x).",
        "price_sensitivities": persona_df["price_sensitivity"].unique().tolist(),
        "age_ranges": persona_df["age_range"].unique().tolist(),
        "gender_skews": persona_df["gender_skew"].unique().tolist(),
        "sample_records": persona_raw[:2],
    }

    return publishers_meta, personas_meta


def execute_query(code: str) -> dict:
    """
    Safely execute a pandas expression.
    Available names: publishers (DataFrame), personas (DataFrame), pd.
    Returns a dict with type, count, and data.
    """
    pub_df, _ = load_publishers()
    persona_df, _ = load_personas()

    safe_builtins = {
        "len": len, "list": list, "str": str, "int": int, "float": float,
        "bool": bool, "range": range, "sorted": sorted, "reversed": reversed,
        "min": min, "max": max, "sum": sum, "any": any, "all": all,
        "True": True, "False": False, "None": None,
    }
    safe_globals = {"__builtins__": safe_builtins}
    safe_locals = {"publishers": pub_df, "personas": persona_df, "pd": pd}

    result = eval(code, safe_globals, safe_locals)  # noqa: S307

    if isinstance(result, pd.DataFrame):
        return {
            "type": "dataframe",
            "count": len(result),
            "columns": result.columns.tolist(),
            "data": result.to_dict(orient="records"),
        }
    if isinstance(result, pd.Series):
        return {
            "type": "series",
            "count": len(result),
            "data": result.to_dict(),
        }
    return {"type": "scalar", "count": None, "data": result}

export interface Publisher {
  id: string;
  name: string;
  category: string;
  subcategories: string[];
  monthly_impressions: number;
  avg_order_value_usd: number;
  audience: {
    age_skew: string;
    gender_split: { female: number; male: number; other: number };
    top_geos: string[];
    income_tier: string;
  };
  notes: string;
}

export interface ShopperPersona {
  id: string;
  name: string;
  age_range: string;
  gender_skew: string;
  description: string;
  category_affinities: string[];
  price_sensitivity: string;
  messaging_preferences: string[];
  disinterested_in: string[];
  typical_aov_usd: number;
}

export interface RecommendedPublisher {
  publisher_id: string;
  publisher_name: string;
  rank: number;
  fit_score: number;
  reasoning: string;
  key_signals: string[];
  suggested_allocation_pct: number;
}

export interface ExcludedPublisher {
  publisher_id: string;
  publisher_name: string;
  exclusion_reason: string;
}

export interface CreativeVariant {
  headline: string;
  body_copy: string;
  tone: string;
}

export interface PersonaCreative {
  persona_id: string;
  persona_name: string;
  persona_reasoning: string;
  relevance_score: number;
  variants: CreativeVariant[];
}

export interface BudgetAllocation {
  publisher_id: string;
  publisher_name: string;
  allocation_pct: number;
  suggested_daily_spend_usd: number;
  bid_type: "CPM" | "CPC" | "CPA";
  suggested_bid_usd: number;
  rationale: string;
}

export interface CampaignConfig {
  campaign_name: string;
  advertiser_summary: string;
  targeting: {
    age_ranges: string[];
    gender_focus: string[];
    income_tiers: string[];
    geographic_focus: string[];
    category_interests: string[];
    behavioral_signals: string[];
  };
  budget: {
    suggested_daily_budget_usd: number;
    suggested_total_budget_usd: number;
    suggested_duration_days: number;
    publisher_allocation: BudgetAllocation[];
  };
  bid_strategy: {
    primary_type: "CPM" | "CPC" | "CPA";
    rationale: string;
    suggested_range_usd: { min: number; max: number };
  };
  optimization_priority: "brand_awareness" | "performance" | "conversion";
  kpis: string[];
  notes: string;
}

export interface CampaignResult {
  recommended_publishers: RecommendedPublisher[];
  excluded_publishers: ExcludedPublisher[];
  persona_creatives: PersonaCreative[];
  campaign_config: CampaignConfig;
  input_quality_assessment: string;
}

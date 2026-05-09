"use client";

import { useState, useRef } from "react";
import type {
  CampaignResult,
  RecommendedPublisher,
  ExcludedPublisher,
  PersonaCreative,
  BudgetAllocation,
} from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentEvent =
  | { type: "metadata_loading"; message: string }
  | { type: "metadata_loaded"; message: string; publishers_meta: any; personas_meta: any }
  | { type: "agent_start"; message: string }
  | { type: "query_planned"; iteration: number; reasoning: string; code: string }
  | { type: "query_executed"; iteration: number; result_count: number | null; data: any }
  | { type: "query_error"; iteration: number; error: string }
  | { type: "clarification_needed"; question: string; reason: string }
  | { type: "generating_campaign"; message: string }
  | { type: "complete"; result: CampaignResult }
  | { type: "error"; message: string };

const EXAMPLES = [
  { label: "Dog food", text: "We sell premium dog food for senior dogs, targeting owners who care about joint health and longevity. Grain-free, vet-formulated, subscription-based." },
  { label: "Activewear", text: "A sustainable activewear brand for women. Made from recycled ocean plastic. Price point sits between Lululemon and Girlfriend Collective." },
  { label: "Adaptogen drink", text: "We make a non-alcoholic sparkling drink with adaptogens. It's for people who want to feel good without a hangover." },
  { label: "Candles", text: "Small-batch candles poured by hand in Vermont. Natural soy wax, no synthetic fragrances. Mostly bought as gifts." },
  { label: "Cleaning products", text: "Refillable, concentrated cleaning products. Skip the single-use plastic bottles. We want to show up where people who already care about sustainability are checking out." },
  { label: "Protein bars", text: "We sell protein bars that don't taste like cardboard. That's basically the whole pitch." },
];

function fitColor(s: number) {
  if (s >= 0.8) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s >= 0.6) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-red-100 text-red-800 border-red-200";
}
function fitLabel(s: number) {
  if (s >= 0.8) return "Strong fit";
  if (s >= 0.6) return "Moderate fit";
  return "Weak fit";
}
function priorityColor(p: string) {
  if (p === "brand_awareness") return "bg-purple-100 text-purple-800";
  if (p === "performance") return "bg-blue-100 text-blue-800";
  return "bg-green-100 text-green-800";
}
function qualityColor(a: string) {
  const l = a.toLowerCase();
  if (l.startsWith("good")) return "bg-emerald-50 border-emerald-200 text-emerald-900";
  if (l.startsWith("ambiguous")) return "bg-amber-50 border-amber-200 text-amber-900";
  return "bg-red-50 border-red-200 text-red-900";
}
function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full border border-indigo-100">
      {label}
    </span>
  );
}

function PublisherCard({ pub, index }: { pub: RecommendedPublisher; index: number }) {
  const [open, setOpen] = useState(index < 3);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <button className="w-full text-left p-5 flex items-start gap-4 hover:bg-gray-50 transition-colors" onClick={() => setOpen(!open)}>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">{pub.rank}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-base">{pub.publisher_name}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${fitColor(pub.fit_score)}`}>
              {fitLabel(pub.fit_score)} — {(pub.fit_score * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {pub.key_signals.map((s, i) => <span key={i} className="text-xs text-gray-500">{i > 0 ? "· " : ""}{s}</span>)}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-sm font-semibold text-indigo-600">{pub.suggested_allocation_pct}%</div>
          <div className="text-xs text-gray-400">of budget</div>
        </div>
        <svg className={`flex-shrink-0 w-4 h-4 text-gray-400 mt-1 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100 pt-4"><p className="text-sm text-gray-700 leading-relaxed">{pub.reasoning}</p></div>}
    </div>
  );
}

function ExcludedList({ excluded }: { excluded: ExcludedPublisher[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {excluded.length} publishers excluded
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {excluded.map((p) => (
            <div key={p.publisher_id} className="flex items-start gap-3 text-sm bg-white rounded-lg border border-gray-100 px-4 py-3">
              <span className="font-medium text-gray-700 whitespace-nowrap">{p.publisher_name}</span>
              <span className="text-gray-400 leading-relaxed">{p.exclusion_reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonaCard({ pc }: { pc: PersonaCreative }) {
  const colors = ["border-indigo-200 bg-indigo-50", "border-purple-200 bg-purple-50", "border-teal-200 bg-teal-50", "border-rose-200 bg-rose-50", "border-amber-200 bg-amber-50"];
  const headerColors = ["text-indigo-800", "text-purple-800", "text-teal-800", "text-rose-800", "text-amber-800"];
  const hash = pc.persona_id.charCodeAt(pc.persona_id.length - 1) % 5;
  return (
    <div className={`rounded-xl border-2 ${colors[hash]} p-5`}>
      <div className="mb-3">
        <h4 className={`font-semibold text-base ${headerColors[hash]}`}>{pc.persona_name}</h4>
        <div className="text-xs text-gray-500 mt-0.5">Relevance: {(pc.relevance_score * 100).toFixed(0)}%</div>
      </div>
      <p className="text-sm text-gray-700 mb-4 leading-relaxed italic">&ldquo;{pc.persona_reasoning}&rdquo;</p>
      <div className="space-y-3">
        {pc.variants.map((v, i) => (
          <div key={i} className="bg-white rounded-lg p-4 border border-white/80 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Variant {i + 1}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{v.tone}</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm mb-1">{v.headline}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{v.body_copy}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetBar({ alloc }: { alloc: BudgetAllocation }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium text-gray-800">{alloc.publisher_name}</span>
        <div className="text-right">
          <span className="text-gray-900 font-semibold">${alloc.suggested_daily_spend_usd}/day</span>
          <span className="text-xs text-gray-400 ml-2">{alloc.bid_type} ${alloc.suggested_bid_usd}</span>
        </div>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="absolute left-0 top-0 h-full bg-indigo-500 rounded-full" style={{ width: `${alloc.allocation_pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{alloc.allocation_pct}% of budget</span>
        <span className="text-right max-w-xs truncate">{alloc.rationale}</span>
      </div>
    </div>
  );
}

function CampaignConfigView({ config }: { config: CampaignResult["campaign_config"] }) {
  const { targeting, budget, bid_strategy, optimization_priority, kpis, notes } = config;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Targeting</h3>
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {([["Age", targeting.age_ranges], ["Gender", targeting.gender_focus], ["Income", targeting.income_tiers], ["Geography", targeting.geographic_focus], ["Category Interests", targeting.category_interests], ["Behavioral Signals", targeting.behavioral_signals]] as [string, string[]][]).map(([label, vals]) => vals.length > 0 && (
            <div key={label}>
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{label}</div>
              <div className="flex flex-wrap gap-2">{vals.map((v, i) => <Tag key={i} label={v} />)}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Budget & Bid Strategy</h3>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-3 gap-4 mb-6 pb-5 border-b border-gray-100">
            {([["$" + budget.suggested_daily_budget_usd.toLocaleString(), "Daily Budget"], ["$" + budget.suggested_total_budget_usd.toLocaleString(), "Total Budget"], [budget.suggested_duration_days + "d", "Campaign Length"]] as [string, string][]).map(([val, lbl]) => (
              <div key={lbl} className="text-center">
                <div className="text-2xl font-bold text-gray-900">{val}</div>
                <div className="text-xs text-gray-500 mt-1">{lbl}</div>
              </div>
            ))}
          </div>
          <div className="mb-6">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-4">Publisher Allocation</div>
            {budget.publisher_allocation.map((a) => <BudgetBar key={a.publisher_id} alloc={a} />)}
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-semibold text-gray-700">Bid Strategy:</span>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">{bid_strategy.primary_type}</span>
              <span className="text-xs text-gray-500">${bid_strategy.suggested_range_usd.min}–${bid_strategy.suggested_range_usd.max}</span>
            </div>
            <p className="text-sm text-gray-600">{bid_strategy.rationale}</p>
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">KPIs & Optimization</h3>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-500">Optimization priority:</span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityColor(optimization_priority)}`}>{optimization_priority.replace("_", " ")}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {kpis.map((kpi, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 font-mono">{kpi}</span>
              </div>
            ))}
          </div>
          {notes && (
            <div className="border-t border-gray-100 pt-4 mt-4">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Notes</div>
              <p className="text-sm text-gray-600 leading-relaxed">{notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TechStep({ event }: { event: AgentEvent }) {
  const [open, setOpen] = useState(event.type === "query_planned" || event.type === "query_executed");
  const icons: Record<string, string> = { metadata_loading: "⚙️", metadata_loaded: "📊", agent_start: "🧠", query_planned: "🔍", query_executed: "✅", query_error: "❌", clarification_needed: "❓", generating_campaign: "⚡", complete: "🎯", error: "🚨" };
  const colors: Record<string, string> = { metadata_loaded: "border-blue-200 bg-blue-50", query_planned: "border-amber-200 bg-amber-50", query_executed: "border-emerald-200 bg-emerald-50", query_error: "border-red-200 bg-red-50", complete: "border-indigo-200 bg-indigo-50", generating_campaign: "border-purple-200 bg-purple-50" };
  const border = colors[event.type] || "border-gray-200 bg-gray-50";
  const hasDetail = ["query_planned", "query_executed", "query_error", "metadata_loaded"].includes(event.type);

  const title = () => {
    if (event.type === "metadata_loading" || event.type === "agent_start" || event.type === "generating_campaign") return event.message;
    if (event.type === "metadata_loaded") return `Dataset loaded — ${event.message}`;
    if (event.type === "query_planned") return `Query #${event.iteration}: ${event.reasoning.slice(0, 80)}${event.reasoning.length > 80 ? "…" : ""}`;
    if (event.type === "query_executed") return `Query #${event.iteration} result: ${event.result_count ?? "N/A"} records returned`;
    if (event.type === "query_error") return `Query #${event.iteration} failed`;
    if (event.type === "clarification_needed") return "Clarification requested";
    if (event.type === "complete") return "Campaign generated successfully";
    if (event.type === "error") return "Error";
    return (event as { type: string }).type;
  };

  return (
    <div className={`rounded-xl border-2 ${border} overflow-hidden`}>
      <button className={`w-full text-left px-4 py-3 flex items-center gap-3 ${hasDetail ? "hover:opacity-80" : "cursor-default"}`} onClick={() => hasDetail && setOpen(!open)}>
        <span className="text-base flex-shrink-0">{icons[event.type] || "•"}</span>
        <span className="text-sm font-medium text-gray-800 flex-1">{title()}</span>
        {hasDetail && <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
      </button>
      {open && hasDetail && (
        <div className="border-t border-gray-200 px-4 py-4 space-y-3">
          {event.type === "metadata_loaded" && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="font-semibold text-gray-700 mb-2">Publishers dataset</div>
                <div className="text-gray-500">Records: {event.publishers_meta?.total_records}</div>
                <div className="text-gray-500">Categories: {event.publishers_meta?.categories?.join(", ")}</div>
                <div className="text-gray-500">Impressions range: {event.publishers_meta?.impressions_range?.min?.toLocaleString()} – {event.publishers_meta?.impressions_range?.max?.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="font-semibold text-gray-700 mb-2">Personas dataset</div>
                <div className="text-gray-500">Records: {event.personas_meta?.total_records}</div>
                <div className="text-gray-500">Price tiers: {event.personas_meta?.price_sensitivities?.join(", ")}</div>
                <div className="text-gray-500">Age ranges: {event.personas_meta?.age_ranges?.join(", ")}</div>
              </div>
            </div>
          )}
          {event.type === "query_planned" && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Why this query</div>
              <p className="text-sm text-gray-700 mb-3">{event.reasoning}</p>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pandas Code Executed</div>
              <pre className="bg-gray-900 text-green-300 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono">{event.code}</pre>
            </div>
          )}
          {event.type === "query_executed" && event.data && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Result — {event.result_count} rows{event.data.columns ? ` · columns: ${event.data.columns.join(", ")}` : ""}</div>
              <div className="max-h-64 overflow-y-auto">
                <pre className="bg-gray-50 text-gray-700 text-xs p-3 rounded-lg overflow-x-auto font-mono">
                  {JSON.stringify(event.data.data, null, 2).slice(0, 3000)}{JSON.stringify(event.data.data).length > 3000 ? "\n… (truncated)" : ""}
                </pre>
              </div>
            </div>
          )}
          {event.type === "query_error" && (
            <div className="text-sm text-red-700 bg-red-50 rounded-lg p-3 font-mono">{event.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

function TechnicalDetails({ events }: { events: AgentEvent[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 mb-2">Every step the AI took to arrive at this campaign — what data it queried, what code it ran, and what it found.</p>
      {events.map((ev, i) => <TechStep key={i} event={ev} />)}
    </div>
  );
}

function ProgressFeed({ events }: { events: AgentEvent[] }) {
  const lastFew = events.slice(-4);
  const queryCount = events.filter((e) => e.type === "query_planned").length;
  const label = (e: AgentEvent): string => {
    if (e.type === "metadata_loading" || e.type === "agent_start" || e.type === "generating_campaign") return e.message;
    if (e.type === "metadata_loaded") return e.message;
    if (e.type === "query_planned") return `Query #${e.iteration}: ${e.reasoning.slice(0, 60)}…`;
    if (e.type === "query_executed") return `Got ${e.result_count ?? "?"} records`;
    if (e.type === "query_error") return `Query error`;
    return e.type;
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-4">
        <svg className="animate-spin w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <div>
          <div className="text-sm font-semibold text-gray-900">{lastFew.length > 0 ? label(lastFew[lastFew.length - 1]) : "Starting..."}</div>
          {queryCount > 0 && <div className="text-xs text-gray-400 mt-0.5">{queryCount} data {queryCount === 1 ? "query" : "queries"} executed so far</div>}
        </div>
      </div>
      <div className="space-y-1.5">
        {lastFew.map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === lastFew.length - 1 ? "bg-indigo-400" : "bg-gray-300"}`} />
            {label(e)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"publishers" | "creative" | "config" | "technical">("publishers");
  const [clarificationQ, setClarificationQ] = useState<{ question: string; reason: string } | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const startGeneration = async (desc: string, clarification?: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    setEvents([]);
    setClarificationQ(null);
    setClarificationAnswer("");

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${apiBase}/campaign/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advertiser_description: desc, clarification: clarification ?? null }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(errData.detail || "Request failed");
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev: AgentEvent = JSON.parse(line.slice(6));
            setEvents((prev) => [...prev, ev]);
            if (ev.type === "complete") { setResult(ev.result); setActiveTab("publishers"); setLoading(false); }
            else if (ev.type === "clarification_needed") { setClarificationQ({ question: ev.question, reason: ev.reason }); setLoading(false); }
            else if (ev.type === "error") { setError(ev.message); setLoading(false); }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: "publishers" as const, label: "Publishers", count: result?.recommended_publishers?.length },
    { key: "creative" as const, label: "Ad Creative", count: result?.persona_creatives?.length },
    { key: "config" as const, label: "Campaign Config" },
    { key: "technical" as const, label: "Technical Details", count: events.filter((e) => e.type === "query_planned").length || undefined },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <div className="font-bold text-gray-900 leading-none">Disco Campaign Builder</div>
            <div className="text-xs text-gray-500">AI-powered publisher matching & ad creative</div>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Describe your advertiser</label>
          <textarea className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none leading-relaxed" rows={3}
            placeholder="Tell us what you sell and who you sell it to." value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startGeneration(description); }} />
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-400 shrink-0">Try an example:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} onClick={() => setDescription(ex.text)}
                className="text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 px-3 py-1.5 rounded-full transition-colors border border-gray-200 hover:border-indigo-200">{ex.label}</button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-gray-400">⌘+Enter to generate</p>
            <button onClick={() => startGeneration(description)} disabled={loading || !description.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2">
              {loading ? (<><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Working...</>) : <>Generate Campaign <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-5 py-4 text-sm mb-6"><strong>Error:</strong> {error}</div>}
        {loading && events.length > 0 && <div className="mb-6"><ProgressFeed events={events} /></div>}

        {clarificationQ && !loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-xl">❓</span>
              <div className="flex-1">
                <div className="font-semibold text-amber-900 mb-1">One clarification needed</div>
                <p className="text-sm text-amber-800 mb-1">{clarificationQ.question}</p>
                <p className="text-xs text-amber-600 mb-3">{clarificationQ.reason}</p>
                <div className="flex gap-2">
                  <input className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    placeholder="Your answer..." value={clarificationAnswer}
                    onChange={(e) => setClarificationAnswer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && clarificationAnswer.trim()) startGeneration(description, clarificationAnswer); }} />
                  <button onClick={() => startGeneration(description, clarificationAnswer)} disabled={!clarificationAnswer.trim()}
                    className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">Continue</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Campaign</div>
                  <div className="font-semibold text-gray-900">{result.campaign_config.campaign_name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{result.campaign_config.advertiser_summary}</div>
                </div>
                <div className={`text-sm border rounded-lg px-4 py-2.5 max-w-sm ${qualityColor(result.input_quality_assessment)}`}>
                  <div className="font-semibold text-xs uppercase tracking-wider mb-1">Input quality</div>
                  <div className="text-xs leading-relaxed">{result.input_quality_assessment}</div>
                </div>
              </div>
            </div>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {tabs.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-indigo-100 text-indigo-700" : "bg-gray-200 text-gray-500"}`}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
            <div>
              {activeTab === "publishers" && <div className="space-y-3">{result.recommended_publishers.map((pub, i) => <PublisherCard key={pub.publisher_id} pub={pub} index={i} />)}<ExcludedList excluded={result.excluded_publishers} /></div>}
              {activeTab === "creative" && <div className="grid grid-cols-1 gap-4">{result.persona_creatives.map((pc) => <PersonaCard key={pc.persona_id} pc={pc} />)}</div>}
              {activeTab === "config" && <CampaignConfigView config={result.campaign_config} />}
              {activeTab === "technical" && <TechnicalDetails events={events} />}
            </div>
          </div>
        )}

        {!result && !loading && !error && events.length === 0 && !clarificationQ && (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <p className="text-sm">Describe an advertiser above to generate a campaign plan</p>
          </div>
        )}
      </main>
    </div>
  );
}

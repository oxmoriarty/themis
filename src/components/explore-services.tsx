"use client";

import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

import type { ServiceProfileResponse } from "@/api/contracts";

type Service = ServiceProfileResponse["service"];

export function ExploreServices() {
  const [query, setQuery] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(null);
      const search = new URLSearchParams();
      if (query.trim()) search.set("query", query.trim());
      if (jurisdiction.trim()) search.set("jurisdiction", jurisdiction.trim());
      try {
        const response = await fetch(`/api/v1/services?${search.toString()}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message ?? "Services could not be loaded.");
        setServices(body.services ?? []);
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Services could not be loaded.");
      } finally { setLoading(false); }
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, jurisdiction]);

  return <div className="explore-layout">
    <aside className="filters"><div><p className="eyebrow">Search the network</p><h2 style={{ fontFamily: "var(--serif)", fontWeight: 400, margin: 0 }}>Find a fit.</h2></div><label className="field"><span>Search by name</span><div style={{ position: "relative" }}><Search size={16} style={{ left: 12, position: "absolute", top: 14 }} aria-hidden="true" /><input className="input" style={{ paddingLeft: 38 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. contracts" /></div></label><label className="field"><span>Jurisdiction</span><input className="input" value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} placeholder="e.g. Nigeria" /></label><p style={{ color: "var(--ink-soft)", fontSize: ".82rem", margin: 0 }}><SlidersHorizontal size={14} aria-hidden="true" /> Results include active, real profiles only.</p></aside>
    <section aria-live="polite"><div className="results-head"><p>{loading ? "Looking for service agents…" : `${services.length} matching service agent${services.length === 1 ? "" : "s"}`}</p><Link className="button button--quiet" href="/developer">Register yours</Link></div>{error && <div className="error" role="alert">{error}</div>}{loading ? <p className="loading">Reading the live registry…</p> : services.length === 0 ? <div className="empty"><strong>No active profiles match yet.</strong><p>Try a broader name or jurisdiction. Themis will not fill this list with invented providers.</p></div> : <div className="card-grid">{services.map((service) => <article className="service-card" key={service.id}><span className="status status--active">Available</span><h3>{service.name}</h3><p>{service.description}</p><div className="tag-row">{service.services.slice(0, 3).map((item) => <span className="tag" key={item}>{item}</span>)}</div><div className="service-card-footer"><span style={{ color: "var(--ink-soft)", fontSize: ".82rem" }}>{service.completedMatterCount} completed matters</span><Link className="button button--quiet" href={`/services/${service.id}`}>Profile</Link></div></article>)}</div>}</section>
  </div>;
}

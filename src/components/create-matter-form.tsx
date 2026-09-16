"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import type { ServiceProfileResponse } from "@/api/contracts";
import { ThemisClient, ThemisApiError } from "@/sdk/themis-client";
import { useSession } from "@/components/session-context";
import { SessionPanel } from "@/components/session-panel";

type Service = ServiceProfileResponse["service"];

export function CreateMatterForm({ initialServiceId }: Readonly<{ initialServiceId?: string }>) {
  const { accessToken } = useSession();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedId, setSelectedId] = useState(initialServiceId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdMatterId, setCreatedMatterId] = useState<string | null>(null);

  useEffect(() => { void (async () => { try { const client = new ThemisClient({ baseUrl: `${window.location.origin}/api/v1` }); const list = await client.services.search({ limit: 50 }); setServices(list); if (!selectedId && list[0]) setSelectedId(list[0].id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Services could not be loaded."); } finally { setLoading(false); } })(); }, [selectedId]);
  const selected = services.find((service) => service.id === selectedId);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); setCreatedMatterId(null); if (!selected) { setError("Choose an active legal service agent."); return; } if (!accessToken) { setError("Add a valid Supabase session token before creating a private matter."); return; } setSubmitting(true); try { const client = new ThemisClient({ baseUrl: `${window.location.origin}/api/v1`, accessToken }); const matter = await client.matters.create({ title, privateDescription: description, serviceId: selected.id, providerWalletAddress: selected.ownerWallet }); setCreatedMatterId(matter.id); } catch (reason) { setError(reason instanceof ThemisApiError ? reason.message : "The matter could not be created."); } finally { setSubmitting(false); } }
  return <div className="form-layout"><section className="form-panel"><p className="eyebrow">New authenticated matter</p><h1 className="page-title">Start with the written obligation.</h1><p className="lead">This creates a private off-chain draft with the provider drawn from the live registry. It does not send a wallet transaction or collect payment.</p><hr className="divider" /><form className="form-grid" onSubmit={(event) => void submit(event)}><label className="field"><span>Legal service agent</span><select className="select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={loading}>{loading ? <option>Loading services…</option> : services.length ? services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>) : <option>No active profiles</option>}</select></label><label className="field"><span>Matter title</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} minLength={1} maxLength={160} required placeholder="e.g. Invoice acceptance" /></label><label className="field"><span>Private matter description</span><textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} minLength={1} maxLength={8000} required placeholder="Describe the service request and context. Do not put consensus-evidence instructions here." /></label>{error && <div className="error" role="alert">{error}</div>}{createdMatterId && <div className="notice"><strong><CheckCircle2 size={16} aria-hidden="true" /> Matter draft created</strong><Link href={`/matters/${createdMatterId}`}>Open the real matter record <ArrowRight size={14} aria-hidden="true" /></Link></div>}<div className="form-actions"><button className="button button--signal" disabled={submitting || loading || !services.length} type="submit">{submitting ? "Creating draft…" : "Create matter draft"} <ArrowRight size={16} aria-hidden="true" /></button><span style={{ color: "var(--ink-soft)", fontSize: ".85rem" }}>Requires a verified wallet identity on your authenticated account.</span></div></form></section><aside><SessionPanel /><div className="side-note"><h3>What happens next</h3><p>The matter dashboard keeps the product matter state and any observed GenLayer transaction states separate. Contract actions remain disabled until the Studio Next deployment, fee, and wallet gates have actually passed.</p></div></aside></div>;
}

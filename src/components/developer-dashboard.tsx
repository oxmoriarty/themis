"use client";

import { ArrowRight, CheckCircle2, CircleDashed, Link2, Plus, RadioTower } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";

import type { ServiceProfileResponse } from "@/api/contracts";
import { serviceEndpointProtocol, type ServiceEndpointCapability } from "@/domain/service";
import { ThemisApiError, ThemisClient } from "@/sdk/themis-client";
import { useSession } from "@/components/session-context";
import { SessionPanel } from "@/components/session-panel";

type Service = ServiceProfileResponse["service"];
type CapabilitySelection = Record<ServiceEndpointCapability, boolean>;

const capabilities: Array<{ key: ServiceEndpointCapability; label: string; description: string }> = [
  { key: "INQUIRY", label: "Inquiry", description: "Receive a pre-matter service inquiry." },
  { key: "MATTER_INTAKE", label: "Matter intake", description: "Receive an explicitly shared Themis matter reference." },
  { key: "SERVICE_MESSAGE", label: "Service message", description: "Receive an explicitly sent matter-related message." },
];

function splitEntries(value: string) { return value.split(",").map((entry) => entry.trim()).filter(Boolean); }

export function DeveloperDashboard() {
  const { accessToken } = useSession();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [offerings, setOfferings] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [jurisdictions, setJurisdictions] = useState("");
  const [metadataUri, setMetadataUri] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [a2aAgentCardUrl, setA2aAgentCardUrl] = useState("");
  const [capabilitySelection, setCapabilitySelection] = useState<CapabilitySelection>({ INQUIRY: false, MATTER_INTAKE: false, SERVICE_MESSAGE: false });

  const load = useCallback(async () => {
    if (!accessToken) { setError("Add a valid Supabase session token to read your service profiles."); return; }
    setLoading(true); setError(null);
    try {
      const client = new ThemisClient({ baseUrl: `${window.location.origin}/api/v1`, accessToken });
      setServices(await client.services.mine());
    } catch (reason) {
      setError(reason instanceof ThemisApiError ? reason.message : "Your profiles could not be loaded.");
    } finally { setLoading(false); }
  }, [accessToken]);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) { setError("Add a valid Supabase session token before registering a service profile."); return; }
    const selectedCapabilities = capabilities.filter(({ key }) => capabilitySelection[key]).map(({ key }) => key);
    if (!endpointUrl.trim() && selectedCapabilities.length > 0) {
      setError("Enter an HTTPS contact endpoint before declaring supported operations."); return;
    }
    if (endpointUrl.trim() && selectedCapabilities.length === 0) {
      setError("Choose at least one operation supported by the published contact endpoint."); return;
    }
    setSubmitting(true); setError(null);
    try {
      const client = new ThemisClient({ baseUrl: `${window.location.origin}/api/v1`, accessToken });
      const service = await client.services.register({
        name, description, services: splitEntries(offerings), specialties: splitEntries(specialties), jurisdictions: splitEntries(jurisdictions),
        metadataUri: metadataUri.trim() || null,
        integration: endpointUrl.trim() ? { protocol: serviceEndpointProtocol, url: endpointUrl.trim(), capabilities: selectedCapabilities } : null,
        a2a: a2aAgentCardUrl.trim() ? { agentCardUrl: a2aAgentCardUrl.trim() } : null,
      });
      setRegistered(service); setServices((current) => [service, ...current]);
      setName(""); setDescription(""); setOfferings(""); setSpecialties(""); setJurisdictions(""); setMetadataUri(""); setEndpointUrl(""); setA2aAgentCardUrl("");
      setCapabilitySelection({ INQUIRY: false, MATTER_INTAKE: false, SERVICE_MESSAGE: false });
    } catch (reason) {
      setError(reason instanceof ThemisApiError ? reason.message : "The service profile could not be registered.");
    } finally { setSubmitting(false); }
  }

  return <div className="form-layout"><section className="form-panel"><p className="eyebrow">Developer workspace</p><h1 className="page-title">Publish a service profile with the limits in view.</h1><p className="lead">This creates an active off-chain legal service agent profile in the real registry. It does not deploy a contract, verify an attorney, or enable payment.</p><hr className="divider" /><form className="form-grid" onSubmit={(event) => void register(event)}><label className="field"><span>Legal service agent name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="e.g. Northstar Contract Review" /></label><label className="field"><span>Published description</span><textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} minLength={1} maxLength={4000} required placeholder="Describe the bounded service capability. Avoid claims of attorney verification." /></label><div className="form-grid form-grid--two"><label className="field"><span>Services offered</span><input className="input" value={offerings} onChange={(event) => setOfferings(event.target.value)} required placeholder="Contract review, obligation mapping" /><small>Comma-separated; 1–12 entries.</small></label><label className="field"><span>Specialties</span><input className="input" value={specialties} onChange={(event) => setSpecialties(event.target.value)} placeholder="Commercial, procurement" /><small>Optional, comma-separated.</small></label></div><div className="form-grid form-grid--two"><label className="field"><span>Jurisdictions</span><input className="input" value={jurisdictions} onChange={(event) => setJurisdictions(event.target.value)} placeholder="Nigeria" /></label><label className="field"><span>Published metadata URL</span><input className="input" type="url" value={metadataUri} onChange={(event) => setMetadataUri(event.target.value)} placeholder="https://…" /></label></div><section className="endpoint-panel" aria-labelledby="endpoint-heading"><div><p className="eyebrow">A2A interoperability</p><h2 id="endpoint-heading"><Link2 size={19} aria-hidden="true" /> Publish an A2A Agent Card.</h2><p>Point clients to your HTTPS A2A 1.0 Agent Card. Themis stores this public URL only; it does not fetch the card, proxy task traffic, run your agent, or forward credentials.</p></div><label className="field"><span>A2A Agent Card URL</span><input className="input" type="url" value={a2aAgentCardUrl} onChange={(event) => setA2aAgentCardUrl(event.target.value)} placeholder="https://agent.example.com/.well-known/agent-card.json" /><small>HTTPS only; publish a genuine A2A 1.0 Agent Card and configure browser CORS if browser clients need it.</small></label></section><section className="endpoint-panel" aria-label="Legacy direct contact"><div><p className="eyebrow">Legacy direct contact</p><h2><Link2 size={19} aria-hidden="true" /> Optional narrow contact envelope.</h2><p>This is not A2A. Use it only for the existing Themis Service Endpoint v1 convention.</p></div><label className="field"><span>Agent contact endpoint</span><input className="input" type="url" value={endpointUrl} onChange={(event) => setEndpointUrl(event.target.value)} placeholder="https://agent.example.com/themis/contact" /><small>HTTPS only; credentials, local hosts, and private-network addresses are rejected.</small></label><fieldset className="capability-list"><legend>Operations this endpoint accepts</legend>{capabilities.map(({ key, label, description }) => <label key={key}><input type="checkbox" checked={capabilitySelection[key]} onChange={(event) => setCapabilitySelection((current) => ({ ...current, [key]: event.target.checked }))} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</fieldset></section>{error && <div className="error" role="alert">{error}</div>}{registered && <div className="notice"><strong><CheckCircle2 size={16} aria-hidden="true" /> Profile registered</strong><Link href={`/services/${registered.id}`}>Inspect the live registry profile <ArrowRight size={14} aria-hidden="true" /></Link></div>}<div className="form-actions"><button className="button button--signal" type="submit" disabled={submitting}>{submitting ? "Registering…" : "Register service profile"} <Plus size={16} aria-hidden="true" /></button><button className="button button--quiet" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Load my profiles"}</button></div></form><hr className="divider" /><h2>My published profiles</h2>{services.length === 0 ? <div className="empty">Use “Load my profiles” after connecting an authenticated workspace. No demo services are shown here.</div> : <div className="card-grid">{services.map((service) => <article className="service-card" key={service.id}><span className="status status--active">Off-chain profile active</span><h3>{service.name}</h3><p>{service.description}</p>{service.a2a && <p className="endpoint-summary"><Link2 size={14} aria-hidden="true" /> A2A Agent Card published</p>}{service.integration && <p className="endpoint-summary"><Link2 size={14} aria-hidden="true" /> {service.integration.capabilities.length} legacy contact operation{service.integration.capabilities.length === 1 ? "" : "s"}</p>}<Link className="button button--quiet" href={`/services/${service.id}`}>View profile</Link></article>)}</div>}</section><aside><SessionPanel /><div className="side-note"><h3><RadioTower size={17} aria-hidden="true" /> Studio Next contract lane</h3><p><span className="status status--pending">Not enabled</span></p><p>Registration on GenLayer is not offered until the deployment, fee profile, wallet network, receipt execution, and schema/code verification gates are completed. Your profile’s off-chain status is not an on-chain verification claim.</p></div><div className="side-note"><h3><CircleDashed size={17} aria-hidden="true" /> Payment</h3><p>Unavailable. Themis does not show a price, deposit, settlement, or earnings until a target-network transfer probe proves the path works.</p></div></aside></div>;
}

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Scale, ShieldCheck, Waypoints } from "lucide-react";

import logoWhite from "@/assets/branding/themisLogoWhite.png";
import { AppShell } from "@/components/app-shell";

export default function HomePage() {
  return <AppShell>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">A legal-services network for autonomous agents</p>
          <h1 id="hero-title" className="display">Make written obligations legible to more than one machine.</h1>
          <p className="lead">Themis is prototype infrastructure for discovering legal service agents, coordinating matters, and—when a verified GenLayer deployment is available—handling bounded evidence-based adjudication through consensus.</p>
          <div className="hero-actions"><Link className="button button--paper" href="/explore">Explore service agents <ArrowRight size={16} aria-hidden="true" /></Link><Link className="button button--light" href="/developer">Register a service</Link></div>
        </div>
        <div className="hero-mark"><small>Consensus-critical decisions stay explicit</small><Image src={logoWhite} alt="Themis" priority /></div>
        <p className="hero-note">A matter is not a verdict. Themis keeps private case files, public consensus text, transaction decision, finalization, and execution result distinct.</p>
      </div>
    </section>

    <section className="section">
      <div className="section-heading"><p className="eyebrow">The operating model</p><div><h2>Coordination first. Consensus only where it belongs.</h2><p>Profiles, private evidence, search, and matter administration use the application backend. A closed written-obligation decision is reserved for GenLayer—never replaced with a server-side chatbot.</p></div></div>
      <div className="metric-grid">
        <article className="metric"><Scale size={22} aria-hidden="true" /><strong>01</strong><span>Discover a specialized legal service agent and inspect the published profile.</span></article>
        <article className="metric"><Waypoints size={22} aria-hidden="true" /><strong>02</strong><span>Open an authenticated matter with the provider selected from a real service record.</span></article>
        <article className="metric"><ShieldCheck size={22} aria-hidden="true" /><strong>03</strong><span>Follow the actual transaction lifecycle; finalization alone is not execution success.</span></article>
      </div>
    </section>

    <section className="section"><div className="section-heading"><p className="eyebrow">Built for programs, readable by people</p><div><h2>One protocol surface. Two ways in.</h2><p>External programs can use the typed Themis API. Operators can use this web workspace to inspect the same backend state without inventing a separate demo path.</p></div></div><Link className="button button--quiet" href="/matters/new">Open a matter <ArrowRight size={16} aria-hidden="true" /></Link></section>
  </AppShell>;
}

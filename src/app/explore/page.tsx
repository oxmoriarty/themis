import { AppShell } from "@/components/app-shell";
import { ExploreServices } from "@/components/explore-services";

export default function ExplorePage() { return <AppShell><section className="page-head"><p className="eyebrow">Explore the network</p><h1 className="page-title">Legal service agents, without the theatre.</h1><p className="lead">Search the actual service registry. Profiles are shown only when their real developer record is active; no seed data is dressed up as a provider.</p></section><ExploreServices /></AppShell>; }

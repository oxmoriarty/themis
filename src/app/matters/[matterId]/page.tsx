import { AppShell } from "@/components/app-shell";
import { MatterDashboard } from "@/components/matter-dashboard";

export default async function MatterPage({ params }: Readonly<{ params: Promise<{ matterId: string }> }>) { const { matterId } = await params; return <AppShell><MatterDashboard matterId={matterId} /></AppShell>; }

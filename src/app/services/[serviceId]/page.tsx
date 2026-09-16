import { AppShell } from "@/components/app-shell";
import { ServiceProfile } from "@/components/service-profile";

export default async function ServicePage({ params }: Readonly<{ params: Promise<{ serviceId: string }> }>) { const { serviceId } = await params; return <AppShell><ServiceProfile serviceId={serviceId} /></AppShell>; }

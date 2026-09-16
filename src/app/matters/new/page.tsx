import { AppShell } from "@/components/app-shell";
import { CreateMatterForm } from "@/components/create-matter-form";

export default async function NewMatterPage({ searchParams }: Readonly<{ searchParams: Promise<{ serviceId?: string }> }>) { const { serviceId } = await searchParams; return <AppShell><CreateMatterForm initialServiceId={serviceId} /></AppShell>; }

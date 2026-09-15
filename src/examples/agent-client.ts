import { ThemisClient } from "@/sdk/themis-client";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before creating a matter.`);
  return value;
}

async function main(): Promise<void> {
  const themis = new ThemisClient({
    baseUrl: process.env.THEMIS_API_BASE_URL ?? "http://localhost:3000/api/v1",
    accessToken: process.env.THEMIS_SUPABASE_ACCESS_TOKEN,
  });

  const services = await themis.services.search({ limit: 10 });
  console.log(JSON.stringify({ discoveredServices: services.map(({ id, name, services: offerings }) => ({ id, name, offerings })) }, null, 2));

  if (!process.env.THEMIS_SUPABASE_ACCESS_TOKEN) return;

  const selected = services.find((service) => service.id === process.env.THEMIS_SERVICE_ID) ?? services[0];
  if (!selected) throw new Error("No active REAL legal service agent is available.");

  const matter = await themis.matters.create({
    title: requiredEnvironment("THEMIS_MATTER_TITLE"),
    privateDescription: requiredEnvironment("THEMIS_MATTER_DESCRIPTION"),
    serviceId: selected.id,
    providerWalletAddress: selected.ownerWallet,
  });
  const status = await themis.matters.get(matter.id);

  console.log(JSON.stringify({
    matterId: status.id,
    matterState: status.state,
    viewerRole: status.viewerRole,
    chainTransactions: status.chainTransactions,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { registerServiceRequestSchema, serviceSearchQuerySchema } from "@/api/contracts";
import { requireWalletIdentity } from "@/server/matters";
import { ApiError } from "@/server/errors";

type ServiceRow = {
  id: string;
  onchain_service_id: string | null;
  owner_wallet: { address: string } | { address: string }[] | null;
  name: string;
  description: string;
  services: string[];
  specialties: string[];
  jurisdictions: string[];
  metadata_uri: string | null;
  metadata_hash: string | null;
  agent_endpoint_url: string | null;
  agent_endpoint_protocol: "themis-service-endpoint-v1" | null;
  agent_endpoint_capabilities: ("INQUIRY" | "MATTER_INTAKE" | "SERVICE_MESSAGE")[] | null;
  availability: "ACTIVE" | "PAUSED" | "INACTIVE";
  source: "REAL" | "SEED";
  completed_matter_count: number;
  created_at: string;
  updated_at: string;
};

function mapService(row: ServiceRow) {
  const ownerWallet = Array.isArray(row.owner_wallet) ? row.owner_wallet[0] : row.owner_wallet;
  if (!ownerWallet?.address) {
    throw new ApiError(500, "DATABASE_ERROR", "The service profile is missing its provider wallet.");
  }

  return {
    id: row.id,
    onchainServiceId: row.onchain_service_id,
    ownerWallet: ownerWallet.address,
    name: row.name,
    description: row.description,
    services: row.services,
    specialties: row.specialties,
    jurisdictions: row.jurisdictions,
    metadataUri: row.metadata_uri,
    metadataHash: row.metadata_hash,
    integration: row.agent_endpoint_url && row.agent_endpoint_protocol && row.agent_endpoint_capabilities
      ? { protocol: row.agent_endpoint_protocol, url: row.agent_endpoint_url, capabilities: row.agent_endpoint_capabilities }
      : null,
    availability: row.availability,
    source: row.source,
    completedMatterCount: row.completed_matter_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const serviceSelect = "id, onchain_service_id, owner_wallet:wallet_identities!services_owner_wallet_id_fkey(address), name, description, services, specialties, jurisdictions, metadata_uri, metadata_hash, agent_endpoint_url, agent_endpoint_protocol, agent_endpoint_capabilities, availability, source, completed_matter_count, created_at, updated_at";

export async function discoverServices(
  client: SupabaseClient,
  rawQuery: z.input<typeof serviceSearchQuerySchema>,
) {
  const query = serviceSearchQuerySchema.parse(rawQuery);
  let request = client
    .from("services")
    .select(serviceSelect)
    .eq("availability", "ACTIVE")
    .eq("source", "REAL")
    .order("updated_at", { ascending: false })
    .limit(query.limit);

  // A single ilike filter avoids building a PostgREST expression from a user
  // string. Exact array matching keeps service/jurisdiction filters bounded.
  if (query.query) request = request.ilike("name", `%${query.query}%`);
  if (query.service) request = request.contains("services", [query.service]);
  if (query.jurisdiction) request = request.contains("jurisdictions", [query.jurisdiction]);

  const { data, error } = await request;
  if (error) throw new ApiError(500, "DATABASE_ERROR", "Services could not be discovered.");
  return ((data ?? []) as unknown as ServiceRow[]).map(mapService);
}

export async function getPublicService(client: SupabaseClient, serviceId: string) {
  const { data, error } = await client
    .from("services")
    .select(serviceSelect)
    .eq("id", serviceId)
    .eq("availability", "ACTIVE")
    .eq("source", "REAL")
    .maybeSingle();

  if (error) throw new ApiError(500, "DATABASE_ERROR", "The service profile could not be read.");
  if (!data) throw new ApiError(404, "SERVICE_NOT_FOUND", "The legal service agent was not found.");
  return mapService(data as unknown as ServiceRow);
}

export async function registerServiceProfile(
  client: SupabaseClient,
  userId: string,
  rawInput: z.input<typeof registerServiceRequestSchema>,
) {
  const input = registerServiceRequestSchema.parse(rawInput);
  const ownerWalletId = await requireWalletIdentity(client, userId);
  const { data, error } = await client
    .from("services")
    .insert({
      owner_wallet_id: ownerWalletId,
      name: input.name,
      description: input.description,
      services: input.services,
      specialties: input.specialties,
      jurisdictions: input.jurisdictions,
      metadata_uri: input.metadataUri ?? null,
      agent_endpoint_url: input.integration?.url ?? null,
      agent_endpoint_protocol: input.integration?.protocol ?? null,
      agent_endpoint_capabilities: input.integration?.capabilities ?? null,
      availability: "ACTIVE",
      source: "REAL",
    })
    .select("id")
    .single();

  if (error || !data) throw new ApiError(500, "DATABASE_ERROR", "The legal service agent profile could not be registered.");
  return getPublicService(client, (data as { id: string }).id);
}

export async function getOwnedServices(client: SupabaseClient, userId: string) {
  const ownerWalletId = await requireWalletIdentity(client, userId);
  const { data, error } = await client
    .from("services")
    .select(serviceSelect)
    .eq("owner_wallet_id", ownerWalletId)
    .order("updated_at", { ascending: false });
  if (error) throw new ApiError(500, "DATABASE_ERROR", "Your service profiles could not be read.");
  return ((data ?? []) as unknown as ServiceRow[]).map(mapService);
}

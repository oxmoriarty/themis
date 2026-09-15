import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { serviceSearchQuerySchema } from "@/api/contracts";
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
    availability: row.availability,
    source: row.source,
    completedMatterCount: row.completed_matter_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const serviceSelect = "id, onchain_service_id, owner_wallet:wallet_identities!services_owner_wallet_id_fkey(address), name, description, services, specialties, jurisdictions, metadata_uri, metadata_hash, availability, source, completed_matter_count, created_at, updated_at";

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

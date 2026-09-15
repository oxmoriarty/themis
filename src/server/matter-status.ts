import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/server/errors";
import { requireMatterAccess } from "@/server/supabase";

type MatterRow = {
  id: string;
  onchain_matter_id: string | null;
  contract_address: string | null;
  title: string;
  private_description: string;
  service_id: string;
  state: string;
  agreement_original_sha256: string | null;
  consensus_template_version: string | null;
  created_at: string;
  updated_at: string;
  client_wallet: { address: string } | { address: string }[] | null;
  provider_wallet: { address: string } | { address: string }[] | null;
};

type TransactionRow = {
  transaction_hash: string;
  action: string;
  status: string;
  execution_result: string | null;
  observed_at: string;
};

const matterSelect = "id, onchain_matter_id, contract_address, title, private_description, service_id, state, agreement_original_sha256, consensus_template_version, created_at, updated_at, client_wallet:wallet_identities!matters_client_wallet_id_fkey(address), provider_wallet:wallet_identities!matters_provider_wallet_id_fkey(address)";

export async function getMatterStatus(client: SupabaseClient, userId: string, matterId: string) {
  const access = await requireMatterAccess(client, userId, matterId);
  const { data: matter, error: matterError } = await client
    .from("matters")
    .select(matterSelect)
    .eq("id", matterId)
    .maybeSingle();

  if (matterError) throw new ApiError(500, "DATABASE_ERROR", "The matter could not be read.");
  if (!matter) throw new ApiError(404, "MATTER_NOT_FOUND", "The matter was not found.");

  const { data: transactions, error: transactionError } = await client
    .from("chain_transactions")
    .select("transaction_hash, action, status, execution_result, observed_at")
    .eq("matter_id", matterId)
    .order("observed_at", { ascending: false });
  if (transactionError) throw new ApiError(500, "DATABASE_ERROR", "Matter transaction status could not be read.");

  const row = matter as unknown as MatterRow;
  const clientWallet = Array.isArray(row.client_wallet) ? row.client_wallet[0] : row.client_wallet;
  const providerWallet = Array.isArray(row.provider_wallet) ? row.provider_wallet[0] : row.provider_wallet;
  if (!clientWallet?.address || !providerWallet?.address) {
    throw new ApiError(500, "DATABASE_ERROR", "The matter is missing participant identities.");
  }

  return {
    id: row.id,
    onchainMatterId: row.onchain_matter_id,
    contractAddress: row.contract_address,
    title: row.title,
    privateDescription: row.private_description,
    serviceId: row.service_id,
    state: row.state,
    clientWallet: clientWallet.address,
    providerWallet: providerWallet.address,
    agreementOriginalSha256: row.agreement_original_sha256,
    consensusTemplateVersion: row.consensus_template_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    viewerRole: access.role,
    chainTransactions: (transactions as TransactionRow[]).map((transaction) => ({
      transactionHash: transaction.transaction_hash,
      action: transaction.action,
      status: transaction.status,
      executionResult: transaction.execution_result,
      observedAt: transaction.observed_at,
    })),
  };
}

import { a2aAgentCardSchema, a2aProtocolVersion } from "@/domain/a2a";

export function createThemisA2aAgentCard(origin: string) {
  const safeOrigin = new URL(origin).origin;
  return a2aAgentCardSchema.parse({
    name: "Themis coordination agent",
    description: "Authenticated off-chain discovery and matter-draft coordination for legal service agents. It does not provide legal advice, handle private evidence, submit wallets, or report GenLayer outcomes.",
    version: "1.0.0",
    supportedInterfaces: [{ url: `${safeOrigin}/a2a`, protocolBinding: "JSONRPC", protocolVersion: a2aProtocolVersion }],
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    securitySchemes: {
      SupabaseBearer: { httpAuthSecurityScheme: { scheme: "Bearer", bearerFormat: "JWT", description: "A valid Themis Supabase Auth access token." } },
    },
    securityRequirements: [{ schemes: { SupabaseBearer: { list: [] } } }],
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      { id: "service-discovery", name: "Discover legal service agents", description: "Returns active real Themis service profiles using bounded search filters.", tags: ["themis", "service-discovery"], inputModes: ["application/json"], outputModes: ["application/json"] },
      { id: "matter-draft", name: "Create a Themis matter draft", description: "Creates an authenticated off-chain matter draft for a verified wallet. No contract transaction is submitted.", tags: ["themis", "matter-draft"], inputModes: ["application/json"], outputModes: ["application/json"] },
    ],
  });
}

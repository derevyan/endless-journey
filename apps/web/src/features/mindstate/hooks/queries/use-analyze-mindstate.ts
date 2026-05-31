/**
 * Analyze Mindstate Mutation Hook
 *
 * Triggers manual analysis of a message against a client's mindstate.
 * Uses createMutation for standardized error handling and cache invalidation.
 */
import { mindstateKeys } from "@/shared/lib/query-keys";
import { createMutation } from "@/shared/lib/create-mutation";
import { mindstateClientsApi } from "../../lib";

interface AnalyzeMindstateParams {
  clientId: string;
  key: string;
  message: string;
  sessionId?: string;
}

/**
 * Analyze a message against a client's mindstate
 */
export const useAnalyzeMindstate = createMutation({
  mutationFn: ({ clientId, key, message, sessionId }: AnalyzeMindstateParams) =>
    mindstateClientsApi.analyze(clientId, key, message, sessionId),
  invalidateKeys: (vars) => mindstateKeys.client(vars.clientId),
  errorMessage: "Failed to analyze mindstate",
});

/**
 * Personas Hook
 *
 * TanStack Query hooks for managing test personas.
 * Provides CRUD operations and cleanup actions.
 *
 * @module features/simulator/hooks/use-personas
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLogger, serializeError } from "@journey/logger";
import { notify } from "@/shared/lib/ui/notify";
import {
  simulatorApi,
  type Persona,
  type CreatePersonaRequest,
} from "../lib/simulator-api-client";

const log = createLogger("use-personas");

// =============================================================================
// QUERY KEYS
// =============================================================================

export const personaKeys = {
  all: ["personas"] as const,
  lists: () => [...personaKeys.all, "list"] as const,
  detail: (id: string) => [...personaKeys.all, "detail", id] as const,
};

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Hook to list all personas for the current organization.
 */
export function usePersonas() {
  return useQuery({
    queryKey: personaKeys.lists(),
    queryFn: async () => {
      const response = await simulatorApi.listPersonas();
      return response.personas;
    },
  });
}

/**
 * Hook to get a single persona by ID.
 */
export function usePersona(id: string | null) {
  return useQuery({
    queryKey: personaKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;
      const response = await simulatorApi.getPersona(id);
      return response.persona;
    },
    enabled: !!id,
  });
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Hook to create a new persona.
 */
export function useCreatePersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePersonaRequest) => {
      const response = await simulatorApi.createPersona(data);
      return response.persona;
    },
    onSuccess: (persona) => {
      // Optimistically add persona to cache immediately (before async refetch)
      queryClient.setQueryData<Persona[]>(
        personaKeys.lists(),
        (oldPersonas = []) => [...oldPersonas, persona]
      );

      // Then invalidate to ensure consistency with server
      queryClient.invalidateQueries({ queryKey: personaKeys.lists() });

      log.info({ personaId: persona.id, name: persona.name }, "usePersonas:created");
      notify.success(`Persona "${persona.name}" created`);
    },
    onError: (error) => {
      log.error({ err: serializeError(error) }, "usePersonas:createFailed");
      notify.error("Failed to create persona");
    },
  });
}

/**
 * Hook to delete a persona.
 */
export function useDeletePersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await simulatorApi.deletePersona(id);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: personaKeys.lists() });
      queryClient.removeQueries({ queryKey: personaKeys.detail(id) });
      log.info({ personaId: id }, "usePersonas:deleted");
      notify.success("Persona deleted");
    },
    onError: (error) => {
      log.error({ err: serializeError(error) }, "usePersonas:deleteFailed");
      notify.error("Failed to delete persona");
    },
  });
}

/**
 * Hook to reset a persona's data (clear tags, CRM, sessions).
 */
export function useResetPersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await simulatorApi.resetPersona(id);
      return { id, result: response };
    },
    onSuccess: ({ id, result }) => {
      queryClient.invalidateQueries({ queryKey: personaKeys.detail(id) });
      log.info({ personaId: id, result }, "usePersonas:reset");
      notify.success("Persona data reset", {
        description: `Cleared ${result.tagsDeleted} tags, ${result.sessionsDeleted} sessions`,
      });
    },
    onError: (error) => {
      log.error({ err: serializeError(error) }, "usePersonas:resetFailed");
      notify.error("Failed to reset persona data");
    },
  });
}

/**
 * Hook to cleanup all test data for the organization.
 */
export function useCleanupAllTestData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await simulatorApi.cleanupAllTestData();
      return response;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: personaKeys.all });
      log.info({ result }, "usePersonas:cleanupAll");
      notify.success("Test data cleaned up", {
        description: `Reset ${result.personasReset} personas, deleted ${result.anonymousClientsDeleted} anonymous clients`,
      });
    },
    onError: (error) => {
      log.error({ err: serializeError(error) }, "usePersonas:cleanupAllFailed");
      notify.error("Failed to cleanup test data");
    },
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { Persona, CreatePersonaRequest };

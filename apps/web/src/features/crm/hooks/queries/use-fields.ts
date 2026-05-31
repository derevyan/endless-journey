/**
 * CRM Field Query Hooks
 *
 * TanStack Query hooks for custom field operations.
 * Uses createMutation for standardized error handling and cache invalidation.
 *
 * @module hooks/queries/crm/use-fields
 */

import { useQuery } from "@tanstack/react-query";

import {
  crmFieldsApi,
  type CreateFieldInput,
  type UpdateFieldInput,
} from "@/shared/lib/api";
import { crmKeys } from "@/shared/lib/query-keys";
import { createMutation } from "@/shared/lib/create-mutation";

/**
 * Fetch all custom field definitions
 */
export function useCrmFields() {
  return useQuery({
    queryKey: crmKeys.fields(),
    queryFn: () => crmFieldsApi.getFields(),
  });
}

/**
 * Create a custom field
 */
export const useCreateCrmField = createMutation({
  mutationFn: (input: CreateFieldInput) => crmFieldsApi.createField(input),
  invalidateKeys: crmKeys.fields(),
  successMessage: "Field created",
  errorMessage: "Failed to create field",
});

/**
 * Update a custom field
 */
export const useUpdateCrmField = createMutation({
  mutationFn: ({ fieldId, input }: { fieldId: string; input: UpdateFieldInput }) =>
    crmFieldsApi.updateField(fieldId, input),
  invalidateKeys: crmKeys.fields(),
  successMessage: "Field updated",
  errorMessage: "Failed to update field",
});

/**
 * Delete a custom field
 */
export const useDeleteCrmField = createMutation({
  mutationFn: (fieldId: string) => crmFieldsApi.deleteField(fieldId),
  invalidateKeys: crmKeys.fields(),
  successMessage: "Field deleted",
  errorMessage: "Failed to delete field",
});

import { z } from "zod";
import { FieldTypeSchema } from "./common";

/**
 * CRM Field Schemas
 *
 * Schemas for custom field definitions and CRUD operations.
 */

// Field validation options (for select fields, etc.)
export const FieldValidationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
      })
    )
    .optional(),
});

// Custom field definition entity
export const CustomFieldDefinitionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  key: z.string(),
  fieldType: FieldTypeSchema,
  description: z.string().nullable(),
  validation: FieldValidationSchema.nullable(),
  isRequired: z.boolean().nullable(),
  position: z.number().int(),
  defaultValue: z.unknown().nullable(),
  createdAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date().nullable(),
});

// Create field input
export const CreateFieldInputSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  fieldType: FieldTypeSchema,
  description: z.string().optional(),
  validation: FieldValidationSchema.optional(),
  isRequired: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
});

// Update field input
export const UpdateFieldInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  validation: FieldValidationSchema.optional(),
  isRequired: z.boolean().optional(),
  position: z.number().int().optional(),
  defaultValue: z.unknown().optional(),
});

// Reorder fields input
export const ReorderFieldsInputSchema = z.object({
  fieldIds: z.array(z.string().uuid("Invalid field ID")),
});

// Inferred types
export type FieldValidation = z.infer<typeof FieldValidationSchema>;
export type CustomFieldDefinition = z.infer<typeof CustomFieldDefinitionSchema>;
export type CreateFieldInput = z.infer<typeof CreateFieldInputSchema>;
export type UpdateFieldInput = z.infer<typeof UpdateFieldInputSchema>;
export type ReorderFieldsInput = z.infer<typeof ReorderFieldsInputSchema>;

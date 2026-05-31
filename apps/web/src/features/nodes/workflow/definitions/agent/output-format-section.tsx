/**
 * Output Format Section
 *
 * Section for configuring the output schema in agent node config.
 * Shows an editable JSON schema preview that auto-populates with sensible defaults.
 * When Quick Replies is enabled, automatically extends schema with buttons field.
 *
 * @module features/nodes/workflow/definitions/agent/output-format-section
 */

import { useState, useCallback, useMemo } from "react";
import { Braces, Pencil } from "lucide-react";
import type { ResponseFormat } from "@journey/schemas";

import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badges";
import { JsonHighlight } from "@/shared/components/ui/json-highlight";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import { StructuredOutputDialog } from "@/features/agent-workflows/components/config-panel/structured-output-dialog";

// =============================================================================
// TYPES
// =============================================================================

interface OutputFormatSectionProps {
  /** Current response format configuration */
  responseFormat?: ResponseFormat;
  /** Whether quick reply buttons are enabled */
  enableQuickReplies: boolean;
  /** Callback when response format changes */
  onUpdate: (responseFormat: ResponseFormat | undefined) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Build the default JSON schema for agent responses.
 * Includes buttons field when quick replies are enabled.
 */
export function buildDefaultSchema(enableQuickReplies: boolean): ResponseFormat {
  const properties: Record<string, unknown> = {
    response: { type: "string", description: "The AI response text" },
  };

  if (enableQuickReplies) {
    properties.buttons = {
      type: "array",
      description: "Quick-reply buttons (2-4 options)",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Button text (max 30 chars)" },
          emoji: { type: "string", description: "Optional leading emoji" },
        },
        required: ["label"],
        additionalProperties: false,
      },
    };
  }

  return {
    type: "json_schema",
    name: "ai_response",
    schema: {
      type: "object",
      properties,
      required: ["response"],
      additionalProperties: false,
    },
    strict: true,
    method: "functionCalling",
  };
}

/**
 * Build a simplified schema preview object for display.
 * Shows property names with their types in a readable format.
 */
function buildSchemaPreview(schema: Record<string, unknown>): Record<string, string> {
  const props = (schema.properties || {}) as Record<string, { type?: string; items?: { properties?: Record<string, unknown> } }>;
  const preview: Record<string, string> = {};

  for (const [key, val] of Object.entries(props)) {
    if (val.type === "array") {
      // Show array with item hint
      const itemProps = val.items?.properties;
      if (itemProps) {
        const itemKeys = Object.keys(itemProps).join(", ");
        preview[key] = `[{ ${itemKeys} }]`;
      } else {
        preview[key] = "[...]";
      }
    } else {
      preview[key] = val.type || "any";
    }
  }

  return preview;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function OutputFormatSection({
  responseFormat,
  enableQuickReplies,
  onUpdate,
}: OutputFormatSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Determine format type - default to JSON if not set
  const formatType = responseFormat?.type === "text" ? "text" : "json";

  // Build effective schema - use existing or auto-populate default
  const effectiveSchema = useMemo(() => {
    // If user has custom schema, use it
    if (responseFormat?.type === "json_schema" && responseFormat.schema) {
      return responseFormat;
    }
    // Otherwise, build default with optional buttons
    return buildDefaultSchema(enableQuickReplies);
  }, [responseFormat, enableQuickReplies]);

  // Extract schema details for display
  const schemaName = effectiveSchema.type === "json_schema" ? effectiveSchema.name : "ai_response";
  const schemaPreview = useMemo(() => {
    if (effectiveSchema.type === "json_schema") {
      return buildSchemaPreview(effectiveSchema.schema);
    }
    return { response: "string" };
  }, [effectiveSchema]);

  // Handle format type change (Text/JSON selector)
  const handleFormatChange = useCallback(
    (value: string) => {
      if (value === "text") {
        onUpdate({ type: "text" });
      } else {
        // Switch to JSON - use default schema
        onUpdate(buildDefaultSchema(enableQuickReplies));
      }
    },
    [onUpdate, enableQuickReplies]
  );

  // Handle schema update from dialog
  const handleSchemaUpdate = useCallback(
    (name: string, schema: Record<string, unknown>) => {
      onUpdate({
        type: "json_schema",
        name,
        schema,
        strict: true,
        method: "functionCalling",
      });
    },
    [onUpdate]
  );

  return (
    <div className="space-y-2">
      <Label>Output Format</Label>

      {/* Format selector row */}
      <div className="flex items-center gap-2">
        <Select value={formatType} onValueChange={handleFormatChange}>
          <SelectTrigger className="w-24" data-testid="output-format-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="text">Text</SelectItem>
          </SelectContent>
        </Select>

        {/* Show schema badge when JSON format is selected */}
        {formatType === "json" && (
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80 gap-1"
            onClick={() => setDialogOpen(true)}
            data-testid="output-schema-badge"
          >
            <Braces className="h-3 w-3" />
            {schemaName}
          </Badge>
        )}
      </div>

      {/* Text mode description */}
      {formatType === "text" && (
        <p className="text-xs text-muted-foreground">
          Agent will respond with free-form text. Use for models without structured output support.
        </p>
      )}

      {/* JSON mode - schema preview with edit button */}
      {formatType === "json" && (
        <>
          <div
            className="group relative p-2 bg-muted/50 rounded-md text-xs cursor-pointer hover:bg-muted/70 transition-colors overflow-x-auto border border-transparent hover:border-muted-foreground/20"
            onClick={() => setDialogOpen(true)}
            data-testid="output-schema-preview"
          >
            <JsonHighlight value={schemaPreview} className="whitespace-pre" />
            {/* Edit indicator on hover - top right corner */}
            <div className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Structured output enforces response format.
          </p>
        </>
      )}

      {/* Structured output dialog */}
      <StructuredOutputDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schema={effectiveSchema.type === "json_schema" ? effectiveSchema.schema : undefined}
        name={effectiveSchema.type === "json_schema" ? effectiveSchema.name : undefined}
        onUpdate={handleSchemaUpdate}
      />
    </div>
  );
}

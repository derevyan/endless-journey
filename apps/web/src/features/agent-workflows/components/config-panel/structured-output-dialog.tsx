/**
 * Structured Output Dialog
 *
 * Dialog for configuring JSON schema for structured LLM output.
 * Supports two modes:
 * - Simple: Visual property builder with type dropdown and enum support
 * - Advanced: JSON schema editor using json-edit-react
 *
 * @module features/agent-workflows/components/config-panel/structured-output-dialog
 */

import { githubDarkTheme, githubLightTheme, JsonEditor } from "json-edit-react";
import { Plus, Trash2, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

import {
  createDefaultProperty,
  DEFAULT_STRUCTURED_OUTPUT_CONFIG,
  isValidPropertyName,
  jsonSchemaToSchemaProperties,
  type PropertyType,
  schemaPropertiesToJsonSchema,
  type SchemaProperty,
  type StructuredOutputConfig,
} from "../../types/structured-output";

// =============================================================================
// TYPES
// =============================================================================

interface StructuredOutputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current schema (JSON Schema format) */
  schema?: Record<string, unknown>;
  /** Schema name */
  name?: string;
  /** Callback when schema is updated */
  onUpdate: (name: string, schema: Record<string, unknown>) => void;
}

// =============================================================================
// PROPERTY TYPES
// =============================================================================

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "string", label: "STRING" },
  { value: "number", label: "NUMBER" },
  { value: "boolean", label: "BOOLEAN" },
  { value: "enum", label: "ENUM" },
  { value: "array", label: "ARRAY" },
  { value: "object", label: "OBJECT" },
];

// =============================================================================
// PROPERTY ROW COMPONENT
// =============================================================================

interface PropertyRowProps {
  property: SchemaProperty;
  index: number;
  onUpdate: (index: number, property: SchemaProperty) => void;
  onDelete: (index: number) => void;
}

function PropertyRow({ property, index, onUpdate, onDelete }: PropertyRowProps) {
  const [enumInput, setEnumInput] = useState("");

  const handleAddEnum = useCallback(() => {
    if (enumInput.trim() && !property.enumValues?.includes(enumInput.trim())) {
      onUpdate(index, {
        ...property,
        enumValues: [...(property.enumValues || []), enumInput.trim()],
      });
      setEnumInput("");
    }
  }, [enumInput, property, index, onUpdate]);

  const handleRemoveEnum = useCallback(
    (value: string) => {
      onUpdate(index, {
        ...property,
        enumValues: property.enumValues?.filter((v) => v !== value) || [],
      });
    },
    [property, index, onUpdate]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddEnum();
      }
    },
    [handleAddEnum]
  );

  return (
    <div className="space-y-2 p-3 border rounded-md bg-muted/30">
      <div className="flex items-center gap-2">
        <Input
          value={property.name}
          onChange={(e) => onUpdate(index, { ...property, name: e.target.value })}
          placeholder="Property name"
          className="flex-1 h-8"
        />

        <Select
          value={property.type}
          onValueChange={(value: PropertyType) => onUpdate(index, { ...createDefaultProperty(value), name: property.name, description: property.description })}
        >
          <SelectTrigger className="w-28 h-8" data-testid="property-type-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={property.description || ""}
          onChange={(e) => onUpdate(index, { ...property, description: e.target.value })}
          placeholder="Add description"
          className="flex-1 h-8"
        />

        <Button variant="ghost" size="icon" onClick={() => onDelete(index)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Enum values input */}
      {property.type === "enum" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {property.enumValues?.map((value) => (
              <Badge key={value} variant="secondary" className="cursor-pointer hover:bg-destructive/20" onClick={() => handleRemoveEnum(value)}>
                {value}
                <span className="ml-1 text-muted-foreground">&times;</span>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={enumInput}
              onChange={(e) => setEnumInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add enum value..."
              className="h-7 text-xs"
            />
            <Button variant="outline" size="sm" onClick={handleAddEnum} disabled={!enumInput.trim()} className="h-7 text-xs">
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Array item type selector */}
      {property.type === "array" && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Array item type:</Label>
          <Select
            value={property.arrayItemType || "string"}
            onValueChange={(value: "string" | "number" | "boolean") => onUpdate(index, { ...property, arrayItemType: value })}
          >
            <SelectTrigger className="w-24 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">string</SelectItem>
              <SelectItem value="number">number</SelectItem>
              <SelectItem value="boolean">boolean</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function StructuredOutputDialog({ open, onOpenChange, schema, name, onUpdate }: StructuredOutputDialogProps) {
  const { resolvedTheme } = useTheme();
  const [mode, setMode] = useState<"simple" | "advanced">("simple");

  // Dynamic theme based on app's dark/light mode with smaller font
  const jsonEditorTheme = useMemo(
    () => [
      resolvedTheme === "dark" ? githubDarkTheme : githubLightTheme,
      {
        styles: {
          container: { fontSize: "90%" },
          // Fix dark mode input text visibility
          input: resolvedTheme === "dark" ? ["#e0e0e0", { fontSize: "90%" }] : undefined,
        },
      },
    ],
    [resolvedTheme]
  );

  // Initialize config from props
  const initialConfig = useMemo(() => {
    if (schema) {
      const parsed = jsonSchemaToSchemaProperties(schema);
      return { ...parsed, name: name || parsed.name };
    }
    return { ...DEFAULT_STRUCTURED_OUTPUT_CONFIG, name: name || "response" };
  }, [schema, name]);

  const [config, setConfig] = useState<StructuredOutputConfig>(initialConfig);
  const [advancedSchema, setAdvancedSchema] = useState<Record<string, unknown>>(() => schemaPropertiesToJsonSchema(initialConfig));

  // Reset state when dialog opens (prevents stale state on cancel/reopen)
  useEffect(() => {
    if (open) {
      const newConfig = schema
        ? { ...jsonSchemaToSchemaProperties(schema), name: name || "response" }
        : { ...DEFAULT_STRUCTURED_OUTPUT_CONFIG, name: name || "response" };
      setConfig(newConfig);
      setAdvancedSchema(schemaPropertiesToJsonSchema(newConfig));
      setMode("simple"); // Reset to simple mode
    }
  }, [open, schema, name]);

  // Sync simple mode changes to advanced mode
  useEffect(() => {
    if (mode === "simple") {
      setAdvancedSchema(schemaPropertiesToJsonSchema(config));
    }
  }, [config, mode]);

  // Handle property updates
  const handleUpdateProperty = useCallback((index: number, property: SchemaProperty) => {
    setConfig((prev) => ({
      ...prev,
      properties: prev.properties.map((p, i) => (i === index ? property : p)),
    }));
  }, []);

  const handleDeleteProperty = useCallback((index: number) => {
    setConfig((prev) => ({
      ...prev,
      properties: prev.properties.filter((_, i) => i !== index),
    }));
  }, []);

  const handleAddProperty = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      properties: [...prev.properties, createDefaultProperty("string")],
    }));
  }, []);

  // Handle mode switch
  const handleModeChange = useCallback(
    (newMode: string) => {
      if (newMode === "advanced" && mode === "simple") {
        // Sync to advanced
        setAdvancedSchema(schemaPropertiesToJsonSchema(config));
      } else if (newMode === "simple" && mode === "advanced") {
        // Try to sync back to simple (best effort)
        try {
          const parsed = jsonSchemaToSchemaProperties(advancedSchema);
          setConfig({ ...parsed, name: config.name });
        } catch {
          // Keep current config if parsing fails
        }
      }
      setMode(newMode as "simple" | "advanced");
    },
    [mode, config, advancedSchema]
  );

  // Handle save
  const handleSave = useCallback(() => {
    let finalSchema: Record<string, unknown>;
    let finalName: string;

    if (mode === "simple") {
      finalSchema = schemaPropertiesToJsonSchema(config);
      finalName = config.name;
    } else {
      finalSchema = advancedSchema;
      finalName = (advancedSchema.title as string) || config.name;
    }

    onUpdate(finalName, finalSchema);
    onOpenChange(false);
  }, [mode, config, advancedSchema, onUpdate, onOpenChange]);

  // Validation
  const hasErrors = useMemo(() => {
    if (mode === "simple") {
      return (
        !config.name ||
        config.properties.length === 0 || // Require at least one property
        config.properties.some(
          (p) =>
            !p.name ||
            !isValidPropertyName(p.name) ||
            // Enum must have at least one value
            (p.type === "enum" && (!p.enumValues || p.enumValues.length === 0))
        )
      );
    }
    return false;
  }, [mode, config]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>Structured output (JSON)</DialogTitle>
            <Tabs value={mode} onValueChange={handleModeChange}>
              <TabsList className="h-8">
                <TabsTrigger value="simple" className="text-xs px-3">
                  Simple
                </TabsTrigger>
                <TabsTrigger value="advanced" className="text-xs px-3">
                  Advanced
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <p className="text-sm text-muted-foreground">The model will generate a JSON object that matches this schema.</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {mode === "simple" ? (
            <div className="space-y-4">
              {/* Schema name */}
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={config.name} onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))} placeholder="response_schema" />
              </div>

              {/* Properties header */}
              <div className="space-y-2">
                <Label>Properties</Label>
                {config.properties.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-3">
                    <span className="flex-1">Name</span>
                    <span className="w-28">Type</span>
                    <span className="flex-1">Description</span>
                    <span className="w-8" />
                  </div>
                )}
              </div>

              {/* Property rows */}
              <div className="space-y-2">
                {config.properties.map((property, index) => (
                  <PropertyRow key={property.id} property={property} index={index} onUpdate={handleUpdateProperty} onDelete={handleDeleteProperty} />
                ))}
              </div>

              {/* Add property button */}
              <Button variant="outline" onClick={handleAddProperty} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add property
              </Button>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <JsonEditor
                data={advancedSchema}
                setData={setAdvancedSchema as (data: unknown) => void}
                rootName="schema"
                theme={jsonEditorTheme}
                collapse={2}
                restrictEdit={false}
                restrictDelete={false}
                restrictAdd={false}
                restrictTypeSelection={false}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={hasErrors}>
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

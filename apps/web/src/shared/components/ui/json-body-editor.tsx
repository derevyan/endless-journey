/**
 * JSON Body Editor Component
 *
 * Visual editor for JSON objects with two modes:
 * - Simple: Visual property builder with key-value cards
 * - Advanced: Full JSON editor using json-edit-react
 *
 * Matches the design pattern from StructuredOutputDialog.
 * Requires TemplateProvider context for template variable support.
 */

import { githubDarkTheme, githubLightTheme, JsonEditor } from "json-edit-react";
import { Plus, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useMemo, useState } from "react";

import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { TemplateInput } from "./template-input";

// JSON value types
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
interface JsonObject {
  [key: string]: JsonValue;
}
type JsonArray = JsonValue[];

// Value types for body parameters (matching StructuredOutputDialog pattern)
type BodyValueType = "string" | "number" | "boolean" | "object";

const VALUE_TYPES: { value: BodyValueType; label: string }[] = [
  { value: "string", label: "STRING" },
  { value: "number", label: "NUMBER" },
  { value: "boolean", label: "BOOLEAN" },
  { value: "object", label: "OBJECT" },
];

/**
 * Infer type from current value
 */
function inferType(value: JsonValue): BodyValueType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object" && value !== null) return "object";
  return "string";
}

interface JsonBodyEditorProps {
  value: string;
  onChange: (json: string) => void;
  readOnly?: boolean;
}

/**
 * Parse JSON string safely, return empty object if invalid.
 * Handles template variables like {{variable}} by temporarily replacing them.
 */
function parseJsonSafe(json: string): JsonValue {
  if (!json.trim()) return {};
  try {
    const templates: string[] = [];

    // Template variable pattern: alphanumeric, underscore, dot, asterisk
    // Using [\w.*]+ instead of [^}]+ to prevent greedy matching across JSON structure
    // when a template is incomplete (e.g., {{session.id without closing }})
    const templateVarPattern = /[\w.*]+/;

    // Step 1: Replace quoted templates "{{...}}" with placeholders
    let escaped = json.replace(new RegExp(`"(\\{\\{${templateVarPattern.source}\\}\\})"`, "g"), (_, template) => {
      templates.push(template);
      return `"__TPL_${templates.length - 1}__"`;
    });

    // Step 2: Replace bare templates {{...}} (for numeric values) with quoted placeholders
    escaped = escaped.replace(new RegExp(`\\{\\{${templateVarPattern.source}\\}\\}`, "g"), (match) => {
      templates.push(match);
      return `"__TPL_${templates.length - 1}__"`;
    });

    let parsed = JSON.parse(escaped);

    // Restore templates in the parsed object
    function restoreTemplates(obj: JsonValue): JsonValue {
      if (typeof obj === "string") {
        const match = obj.match(/^__TPL_(\d+)__$/);
        if (match) {
          return templates[parseInt(match[1], 10)];
        }
        return obj.replace(/__TPL_(\d+)__/g, (_, idx) => templates[parseInt(idx, 10)] || "");
      }
      if (Array.isArray(obj)) {
        return obj.map(restoreTemplates);
      }
      if (obj && typeof obj === "object") {
        const restored: JsonObject = {};
        for (const [key, val] of Object.entries(obj)) {
          restored[key] = restoreTemplates(val);
        }
        return restored;
      }
      return obj;
    }

    return restoreTemplates(parsed);
  } catch {
    return {};
  }
}

/**
 * Serialize JSON value to string
 */
function serializeJson(value: JsonValue): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

/**
 * Generate a unique key for new properties
 */
function generateKey(existingKeys: string[]): string {
  let key = "key";
  let counter = 1;
  while (existingKeys.includes(key)) {
    key = `key${counter}`;
    counter++;
  }
  return key;
}

/**
 * Format value for display (truncate if too long)
 */
function formatDisplayValue(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value.length > 40) return value.slice(0, 37) + "...";
    return value;
  }
  if (Array.isArray(value)) return `[${value.length} items]`;
  return `{${Object.keys(value).length} props}`;
}

/**
 * Main JSON Body Editor component
 *
 * Provides Simple mode (visual builder) and Advanced mode (json-edit-react).
 * Must be used within a TemplateProvider.
 */
export function JsonBodyEditor({ value, onChange, readOnly = false }: JsonBodyEditorProps) {
  const { resolvedTheme } = useTheme();
  const [mode, setMode] = useState<"simple" | "advanced">("simple");

  // Theme for json-edit-react with dark mode input fix
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

  // Parse JSON value
  const parsedValue = useMemo(() => parseJsonSafe(value), [value]);

  // Ensure we have an object at the root
  const rootValue = useMemo(
    () => (typeof parsedValue === "object" && parsedValue !== null && !Array.isArray(parsedValue) ? parsedValue : {}),
    [parsedValue]
  );

  // Update handlers for Simple mode
  const handleKeyChange = useCallback(
    (oldKey: string, newKey: string) => {
      if (newKey === oldKey || !newKey.trim()) return;
      const newValue: JsonObject = {};
      for (const [k, v] of Object.entries(rootValue)) {
        newValue[k === oldKey ? newKey : k] = v;
      }
      onChange(serializeJson(newValue));
    },
    [rootValue, onChange]
  );

  const handleValueChange = useCallback(
    (key: string, newVal: JsonValue) => {
      onChange(serializeJson({ ...rootValue, [key]: newVal }));
    },
    [rootValue, onChange]
  );

  const handleDelete = useCallback(
    (key: string) => {
      const { [key]: _, ...rest } = rootValue;
      onChange(serializeJson(rest));
    },
    [rootValue, onChange]
  );

  const handleAdd = useCallback(() => {
    const newKey = generateKey(Object.keys(rootValue));
    onChange(serializeJson({ ...rootValue, [newKey]: "" }));
  }, [rootValue, onChange]);

  const entries = Object.entries(rootValue);

  return (
    <div className="space-y-2">
      {/* Header with Simple/Advanced tabs */}
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">Body Parameters</Label>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "simple" | "advanced")}>
          <TabsList className="h-7">
            <TabsTrigger value="simple" className="text-[10px] px-2 h-5">
              Simple
            </TabsTrigger>
            <TabsTrigger value="advanced" className="text-[10px] px-2 h-5">
              Advanced
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mode === "simple" ? (
        <>
          {/* Property list */}
          <div className="space-y-2">
            {entries.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 px-3 bg-muted/20 rounded-md">No properties defined</p>
            ) : (
              entries.map(([key, val]) => (
                <PropertyRow
                  key={key}
                  propKey={key}
                  value={val}
                  onKeyChange={(newKey) => handleKeyChange(key, newKey)}
                  onValueChange={(newVal) => handleValueChange(key, newVal)}
                  onDelete={() => handleDelete(key)}
                  readOnly={readOnly}
                />
              ))
            )}
          </div>

          {/* Add property button */}
          {!readOnly && (
            <Button type="button" variant="outline" onClick={handleAdd} className="w-full text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add Property
            </Button>
          )}
        </>
      ) : (
        /* Advanced mode: json-edit-react */
        <div className="border rounded-md overflow-hidden">
          <JsonEditor
            data={rootValue}
            setData={(data) => onChange(serializeJson(data as JsonValue))}
            rootName="body"
            theme={jsonEditorTheme}
            collapse={2}
            restrictEdit={readOnly}
            restrictDelete={readOnly}
            restrictAdd={readOnly}
            restrictTypeSelection={false}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Property row component matching StructuredOutputDialog style.
 * Key input on top row with delete button, value input below.
 */
interface PropertyRowProps {
  propKey: string;
  value: JsonValue;
  onKeyChange: (newKey: string) => void;
  onValueChange: (newVal: JsonValue) => void;
  onDelete: () => void;
  readOnly: boolean;
}

function PropertyRow({ propKey, value, onKeyChange, onValueChange, onDelete, readOnly }: PropertyRowProps) {
  // Infer type from current value
  const currentType = inferType(value);
  const isComplex = currentType === "object" || Array.isArray(value);

  // Handle type change - convert value appropriately
  const handleTypeChange = (newType: BodyValueType) => {
    const strValue = typeof value === "string" ? value : String(value ?? "");

    switch (newType) {
      case "number":
        onValueChange(parseFloat(strValue) || 0);
        break;
      case "boolean":
        onValueChange(strValue === "true" || strValue === "1");
        break;
      case "object":
        onValueChange({});
        break;
      default:
        onValueChange(strValue);
    }
  };

  return (
    <div className="space-y-2 p-3 border rounded-md bg-muted/30">
      {/* Row 1: Key + Type + Delete */}
      <div className="flex items-center gap-2">
        <Input
          value={propKey}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder="key"
          className="flex-1 h-8 text-xs font-mono"
          disabled={readOnly}
        />

        <Select value={currentType} onValueChange={handleTypeChange} disabled={readOnly}>
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VALUE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!readOnly && (
          <Button type="button" variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Row 2: Value (full width with TemplateInput) */}
      {isComplex ? (
        <span className="block text-xs font-mono text-muted-foreground px-3 py-2 bg-muted/50 rounded-md">{formatDisplayValue(value)}</span>
      ) : (
        <TemplateInput
          value={typeof value === "string" ? value : String(value ?? "")}
          onChange={(e) => {
            const v = e.target.value;
            // Respect the selected type
            if (currentType === "boolean") {
              onValueChange(v === "true" || v === "1");
            } else if (currentType === "number") {
              // Keep as string while typing, parse on blur or if valid number
              if (/^-?\d*\.?\d*$/.test(v)) {
                onValueChange(v === "" ? 0 : parseFloat(v));
              } else {
                onValueChange(v); // Allow template variables
              }
            } else {
              onValueChange(v);
            }
          }}
          variant="compact"
          placeholder={currentType === "boolean" ? "true or false" : "value or {{variable}}"}
          disabled={readOnly}
        />
      )}
    </div>
  );
}

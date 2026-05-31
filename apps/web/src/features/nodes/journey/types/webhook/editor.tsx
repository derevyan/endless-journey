/**
 * WebhookNodeEditor Component
 *
 * Editor for Webhook node type with:
 * - URL input
 * - Method dropdown (GET, POST, PUT, PATCH, DELETE)
 * - Headers editor (key-value pairs)
 * - Body textarea
 * - Authentication (bearer, basic, apiKey)
 * - Response handling (successPath, storeAs)
 * - Error handling (strategy, retryCount, timeout)
 * - Mock response section
 */

import { Button } from "@/shared/components/ui/button";
import { JsonEditor } from "@/shared/components/ui/codemirror";
import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { Input } from "@/shared/components/ui/input";
import { JsonBodyEditor } from "@/shared/components/ui/json-body-editor";
import { JsonView } from "@/shared/components/ui/json-view";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { TemplateInput } from "@/shared/components/ui/template-input";
import { useArrayField } from "../../hooks/use-array-field";
import { useNodeEditorForm } from "../../hooks/use-node-editor-form";
import type { StringFieldApi, NumberFieldApi, BooleanFieldApi, FormFieldApi } from "../../forms/form-types";
import { cn } from "@/shared/lib/utils";
import { generateShortId } from "@/shared/lib/utils/id";
import { AlertTriangle, FlaskConical, Globe, Key, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { EditorNameField, getErrorMessage } from "../../editors/editor-common-fields";
import { EditorCommonSections } from "../../editors/editor-common-sections";
import { NodeEditorShell } from "../../editors/node-editor-shell";
import type { NodeEditorProps } from "../../editors/types";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const ERROR_STRATEGIES = [
  { value: "continue", label: "Continue on error" },
  { value: "fail", label: "Fail journey" },
  { value: "retry", label: "Retry" },
];

// Header type for webhook - includes id for useArrayField compatibility
interface WebhookHeader {
  id: string;
  key: string;
  value: string;
}

export function WebhookNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useNodeEditorForm(node);
  const [authOpen, setAuthOpen] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [mockOpen, setMockOpen] = useState(false);

  // Use useArrayField for headers management
  const headers = useArrayField<WebhookHeader>(form, "headers");

  const handleAddHeader = useCallback(() => {
    headers.add({ id: generateShortId("hdr"), key: "", value: "" });
  }, [headers]);

  const handleUpdateHeader = useCallback((index: number, field: "key" | "value", value: string) => {
    headers.updateByIndex(index, { [field]: value });
  }, [headers]);

  const handleRemoveHeader = useCallback((index: number) => {
    headers.removeByIndex(index);
  }, [headers]);

  // Helper to get header field errors
  const getHeaderKeyError = (index: number): string | undefined => {
    return validationErrors?.get(`headers.${index}.key`);
  };

  const getHeaderValueError = (index: number): string | undefined => {
    return validationErrors?.get(`headers.${index}.value`);
  };

  return (
    <NodeEditorShell
      node={node}
      form={form}
      isDirty={isDirty}
      isSaving={isSaving}
      validateAndSave={validateAndSave}
      resetForm={resetForm}
      onClose={onClose}
      onDelete={onDelete}
      readOnly={readOnly}
      title={readOnly ? "Webhook Node Info" : "Edit Webhook Node"}
      withTemplateProvider
    >
      {/* 1. Name */}
      <EditorNameField form={form} nodeId={node.id} readOnly={readOnly} />

      {/* Request Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium">Request</Label>
        </div>

        {/* URL */}
        <form.Field name="url">
          {(field: StringFieldApi) => (
            <div className="space-y-1.5">
              <Label htmlFor={`url-${node.id}`} className="text-[11px] text-muted-foreground">
                URL
              </Label>
              <TemplateInput
                id={`url-${node.id}`}
                value={field.state.value || ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="https://api.example.com/endpoint"
                disabled={readOnly}
                hasError={field.state.meta.errors.length > 0}
              />
              {field.state.meta.errors.length > 0 && <p className="text-xs text-destructive">{getErrorMessage(field.state.meta.errors[0])}</p>}
              <p className="text-[10px] text-muted-foreground">
                Supports variables: <code className="bg-muted px-1 rounded">{"{{context.userId}}"}</code>
              </p>
            </div>
          )}
        </form.Field>

        {/* Method */}
        <form.Field name="method">
          {(field: StringFieldApi) => (
            <div className="space-y-1.5">
              <Label htmlFor={`method-${node.id}`} className="text-[11px] text-muted-foreground">
                Method
              </Label>
              <Select
                value={field.state.value || "POST"}
                onValueChange={(value) => field.handleChange(value as (typeof HTTP_METHODS)[number])}
                disabled={readOnly}
              >
                <SelectTrigger size="sm" id={`method-${node.id}`}>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      <span
                        className={cn(
                          "font-mono text-xs",
                          method === "GET" && "text-green-600",
                          method === "POST" && "text-blue-600",
                          method === "PUT" && "text-amber-600",
                          method === "PATCH" && "text-purple-600",
                          method === "DELETE" && "text-red-600"
                        )}
                      >
                        {method}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        {/* Headers */}
        <form.Field name="headers">
          {(field: FormFieldApi<Array<{ id?: string; key: string; value: string }>>) => {
            const headers = (field.state.value || []) as Array<{ id?: string; key: string; value: string }>;
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Headers</Label>
                  {!readOnly && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleAddHeader}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
                {headers.length > 0 ? (
                  <div className="space-y-2">
                    {headers.map((header, index) => {
                      const keyError = getHeaderKeyError(index);
                      const valueError = getHeaderValueError(index);
                      return (
                        <div key={header.id ?? `header-${index}`} className="space-y-1">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 space-y-1">
                              <Input
                                value={header.key}
                                onChange={(e) => handleUpdateHeader(index, "key", e.target.value)}
                                className="h-8 text-xs font-mono"
                                placeholder="Header name"
                                disabled={readOnly}
                                hasError={!!keyError}
                              />
                              {keyError && <p className="text-xs text-destructive">{keyError}</p>}
                            </div>
                            <div className="flex-1 space-y-1">
                              <TemplateInput
                                value={header.value}
                                onChange={(e) => handleUpdateHeader(index, "value", e.target.value)}
                                variant="compact"
                                placeholder="Value"
                                disabled={readOnly}
                                hasError={!!valueError}
                              />
                              {valueError && <p className="text-xs text-destructive">{valueError}</p>}
                            </div>
                            {!readOnly && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => handleRemoveHeader(index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-1">No custom headers</p>
                )}
              </div>
            );
          }}
        </form.Field>

        {/* Body - JsonBodyEditor gets nodeId, nodes, edges from TemplateProvider context */}
        <form.Field name="body">
          {(field: StringFieldApi) => (
            <JsonBodyEditor
              value={field.state.value || "{}"}
              onChange={(json) => field.handleChange(json)}
              readOnly={readOnly}
            />
          )}
        </form.Field>
      </div>

      {/* Authentication - Collapsible */}
      <CollapsibleSection open={authOpen} onOpenChange={setAuthOpen} icon={Key} label="Authentication" paddingClass="pl-6">
          <form.Field name="authType">
            {(field: StringFieldApi) => (
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">Auth Type</Label>
                <Select
                  value={field.state.value || "none"}
                  onValueChange={(value) => field.handleChange(value as "none" | "bearer" | "basic" | "apiKey")}
                  disabled={readOnly}
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="Select auth type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="apiKey">API Key</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          {/* Bearer Token */}
          <form.Field name="authType">
            {(typeField: StringFieldApi) => {
              if (typeField.state.value !== "bearer") return null;
              return (
                <form.Field name="authToken">
                  {(field: StringFieldApi) => (
                    <div className="space-y-1.5">
                      <Label htmlFor={`authToken-${node.id}`} className="text-[11px] text-muted-foreground">
                        Bearer Token
                      </Label>
                      <TemplateInput
                        id={`authToken-${node.id}`}
                        value={field.state.value || ""}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Enter token..."
                        className="h-8 text-sm font-mono"
                        disabled={readOnly}
                      />
                    </div>
                  )}
                </form.Field>
              );
            }}
          </form.Field>

          {/* Basic Auth */}
          <form.Field name="authType">
            {(typeField: StringFieldApi) => {
              if (typeField.state.value !== "basic") return null;
              return (
                <>
                  <form.Field name="authUsername">
                    {(field: StringFieldApi) => (
                      <div className="space-y-1.5">
                        <Label htmlFor={`authUsername-${node.id}`} className="text-[11px] text-muted-foreground">
                          Username
                        </Label>
                        <Input
                          id={`authUsername-${node.id}`}
                          value={field.state.value || ""}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="Username"
                          className="h-8 text-sm"
                          disabled={readOnly}
                        />
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="authPassword">
                    {(field: StringFieldApi) => (
                      <div className="space-y-1.5">
                        <Label htmlFor={`authPassword-${node.id}`} className="text-[11px] text-muted-foreground">
                          Password
                        </Label>
                        <Input
                          id={`authPassword-${node.id}`}
                          type="password"
                          value={field.state.value || ""}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="Password"
                          className="h-8 text-sm"
                          disabled={readOnly}
                        />
                      </div>
                    )}
                  </form.Field>
                </>
              );
            }}
          </form.Field>

          {/* API Key */}
          <form.Field name="authType">
            {(typeField: StringFieldApi) => {
              if (typeField.state.value !== "apiKey") return null;
              return (
                <>
                  <form.Field name="authHeaderName">
                    {(field: StringFieldApi) => (
                      <div className="space-y-1.5">
                        <Label htmlFor={`authHeaderName-${node.id}`} className="text-[11px] text-muted-foreground">
                          Header Name
                        </Label>
                        <Input
                          id={`authHeaderName-${node.id}`}
                          value={field.state.value || ""}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="X-API-Key"
                          className="h-8 text-sm font-mono"
                          disabled={readOnly}
                        />
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="authApiKey">
                    {(field: StringFieldApi) => (
                      <div className="space-y-1.5">
                        <Label htmlFor={`authApiKey-${node.id}`} className="text-[11px] text-muted-foreground">
                          API Key
                        </Label>
                        <TemplateInput
                          id={`authApiKey-${node.id}`}
                          value={field.state.value || ""}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="Enter API key..."
                          className="h-8 text-sm font-mono"
                          disabled={readOnly}
                        />
                      </div>
                    )}
                  </form.Field>
                </>
              );
            }}
          </form.Field>
      </CollapsibleSection>

      {/* Response Handling - Collapsible */}
      <CollapsibleSection open={responseOpen} onOpenChange={setResponseOpen} icon={Globe} label="Response" paddingClass="pl-6">
          <form.Field name="successPath">
            {(field: StringFieldApi) => (
              <div className="space-y-1.5">
                <Label htmlFor={`successPath-${node.id}`} className="text-[11px] text-muted-foreground">
                  Extract Path <span className="font-normal">(JSONPath)</span>
                </Label>
                <Input
                  id={`successPath-${node.id}`}
                  value={field.state.value || ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="$.data.result"
                  className="h-8 text-sm font-mono"
                  disabled={readOnly}
                />
                <p className="text-[10px] text-muted-foreground">JSONPath to extract data from response</p>
              </div>
            )}
          </form.Field>
          <form.Field name="storeAs">
            {(field: StringFieldApi) => (
              <div className="space-y-1.5">
                <Label htmlFor={`storeAs-${node.id}`} className="text-[11px] text-muted-foreground">
                  Store As
                </Label>
                <Input
                  id={`storeAs-${node.id}`}
                  value={field.state.value || ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="webhookResult"
                  className="h-8 text-sm font-mono"
                  disabled={readOnly}
                />
                <p className="text-[10px] text-muted-foreground">
                  Stored in <code className="bg-muted px-1 rounded">context.{field.state.value || "..."}</code>
                </p>
              </div>
            )}
          </form.Field>
      </CollapsibleSection>

      {/* Error Handling - Collapsible */}
      <CollapsibleSection open={errorOpen} onOpenChange={setErrorOpen} icon={AlertTriangle} label="Error Handling" paddingClass="pl-6">
          <form.Field name="errorHandling">
            {(field: StringFieldApi) => (
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">On Error</Label>
                <Select
                  value={field.state.value || "continue"}
                  onValueChange={(value) => field.handleChange(value as "continue" | "fail" | "retry")}
                  disabled={readOnly}
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {ERROR_STRATEGIES.map((strategy) => (
                      <SelectItem key={strategy.value} value={strategy.value}>
                        {strategy.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <form.Field name="retryCount">
            {(field: NumberFieldApi) => (
              <div className="space-y-1.5">
                <Label htmlFor={`retryCount-${node.id}`} className="text-[11px] text-muted-foreground">
                  Retry Count
                </Label>
                <Input
                  id={`retryCount-${node.id}`}
                  type="number"
                  min={0}
                  max={5}
                  value={field.state.value ?? 0}
                  onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 0)}
                  onBlur={field.handleBlur}
                  className="h-8 text-sm"
                  disabled={readOnly}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="timeoutMs">
            {(field: NumberFieldApi) => (
              <div className="space-y-1.5">
                <Label htmlFor={`timeoutMs-${node.id}`} className="text-[11px] text-muted-foreground">
                  Timeout (ms)
                </Label>
                <Input
                  id={`timeoutMs-${node.id}`}
                  type="number"
                  min={1000}
                  max={60000}
                  step={1000}
                  value={field.state.value ?? 30000}
                  onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 30000)}
                  onBlur={field.handleBlur}
                  className="h-8 text-sm"
                  disabled={readOnly}
                />
              </div>
            )}
          </form.Field>
      </CollapsibleSection>

      {/* Mock Response - Collapsible */}
      <CollapsibleSection open={mockOpen} onOpenChange={setMockOpen} icon={FlaskConical} label="Mock Response" paddingClass="pl-6">
          <form.Field name="mockEnabled">
            {(field: BooleanFieldApi) => (
              <div className="flex items-center gap-3">
                <Switch
                  id={`mockEnabled-${node.id}`}
                  checked={field.state.value ?? false}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                  disabled={readOnly}
                />
                <Label htmlFor={`mockEnabled-${node.id}`} className="text-xs">
                  Enable mock response
                </Label>
              </div>
            )}
          </form.Field>

          <form.Field name="mockEnabled">
            {(enabledField: BooleanFieldApi) => {
              if (!enabledField.state.value) return null;
              return (
                <>
                  <form.Field name="mockStatusCode">
                    {(field: NumberFieldApi) => (
                      <div className="space-y-1.5">
                        <Label htmlFor={`mockStatusCode-${node.id}`} className="text-[11px] text-muted-foreground">
                          Status Code
                        </Label>
                        <Input
                          id={`mockStatusCode-${node.id}`}
                          type="number"
                          min={100}
                          max={599}
                          value={field.state.value ?? 200}
                          onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 200)}
                          onBlur={field.handleBlur}
                          className="h-8 text-sm"
                          disabled={readOnly}
                        />
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="mockBody">
                    {(field: StringFieldApi) => {
                      const mockBodyValue = field.state.value || "";
                      const hasTemplates = /\{\{[^}]+\}\}/.test(mockBodyValue);

                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`mockBody-${node.id}`} className="text-[11px] text-muted-foreground">
                              Response Body
                            </Label>
                            {hasTemplates && <span className="text-[10px] text-emerald-400">{"{{}} "}Templates</span>}
                          </div>
                          {readOnly ? (
                            <JsonView value={mockBodyValue} className="min-h-[60px]" />
                          ) : (
                            <JsonEditor
                              value={mockBodyValue}
                              onChange={(value) => field.handleChange(value)}
                              placeholder='{"success": true}'
                              minHeight={60}
                              validateJson
                              disabled={readOnly}
                            />
                          )}
                        </div>
                      );
                    }}
                  </form.Field>
                  <form.Field name="mockDelay">
                    {(field: NumberFieldApi) => (
                      <div className="space-y-1.5">
                        <Label htmlFor={`mockDelay-${node.id}`} className="text-[11px] text-muted-foreground">
                          Delay (ms)
                        </Label>
                        <Input
                          id={`mockDelay-${node.id}`}
                          type="number"
                          min={0}
                          max={10000}
                          step={100}
                          value={field.state.value ?? 0}
                          onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 0)}
                          onBlur={field.handleBlur}
                          className="h-8 text-sm"
                          disabled={readOnly}
                        />
                      </div>
                    )}
                  </form.Field>
                </>
              );
            }}
          </form.Field>
      </CollapsibleSection>

        {/* Common Sections (Tags, Variables, Metadata, Advanced) */}
        <EditorCommonSections form={form} nodeId={node.id} nodeType={node.data.type} readOnly={readOnly} validationErrors={validationErrors} />
    </NodeEditorShell>
  );
}

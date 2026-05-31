/**
 * New Prompt Route
 *
 * Full-page form for creating a new prompt (Langfuse-style).
 * Replaces the dialog pattern with a dedicated page.
 *
 * @module routes/_dashboard.prompts.new
 */

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, FileText, MessageSquare } from "lucide-react";
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { PromptContentEditor } from "@/features/prompts/components";
import { useCreatePrompt } from "@/features/prompts/hooks";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { notify } from "@/shared/lib/ui/notify";
import { promptKeys } from "@/shared/lib/query-keys";
import { promptNameSchema, DEFAULT_PROMPT_CONTENT } from "@journey/schemas";
import type { PromptType, PromptContent } from "@journey/schemas";

// =============================================================================
// ROUTE DEFINITION
// =============================================================================

export const Route = createFileRoute("/_dashboard/prompts/new")({
  component: NewPromptPage,
});


// =============================================================================
// COMPONENT
// =============================================================================

function NewPromptPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createPrompt = useCreatePrompt();

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<PromptType>("text");
  const [content, setContent] = useState<PromptContent>(DEFAULT_PROMPT_CONTENT.text);
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Auto-generate name from display name
  const handleDisplayNameChange = useCallback((value: string) => {
    setDisplayName(value);
    const generatedName = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 100);
    setName(generatedName);
  }, []);

  // Handle type change
  const handleTypeChange = useCallback((newType: PromptType) => {
    setType(newType);
    // Reset content to default for new type
    setContent(newType === "text" ? DEFAULT_PROMPT_CONTENT.text : [...DEFAULT_PROMPT_CONTENT.chat]);
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    // Validate
    const nameResult = promptNameSchema.safeParse(name);
    if (!nameResult.success) {
      setErrors({ name: nameResult.error.issues[0].message });
      return;
    }
    setErrors({});

    try {
      const result = await createPrompt.mutateAsync({
        name,
        description: description || undefined,
        type,
        content,
        // Initial version notes
      });

      notify.success("Prompt created successfully");

      // Refetch prompts list
      await queryClient.refetchQueries({ queryKey: promptKeys.all });

      // Navigate to the new prompt
      navigate({
        to: "/prompts/$promptName",
        params: { promptName: result.name },
      });
    } catch {
      notify.error("Failed to create prompt");
    }
  }, [name, description, type, content, createPrompt, queryClient, navigate]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b bg-background/50 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="size-8 rounded-sm">
            <Link to="/prompts">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight">Create New Prompt</h1>
            <p className="text-xs text-muted-foreground/70">
              Create a versioned prompt template
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!name || createPrompt.isPending}
          className="h-8 bg-primary/95 text-xs font-bold shadow-sm transition-all hover:bg-primary"
        >
          {createPrompt.isPending ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Prompt"
          )}
        </Button>
      </header>

      {/* Main Content - Flex layout matching detail page */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: Form Fields - minimal sidebar styling */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r bg-muted/5">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {/* Section Header */}
            <div className="mb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Prompt Details
              </h3>
              <p className="text-xs text-muted-foreground/70">Basic information</p>
            </div>

            <div className="space-y-4">
              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => handleDisplayNameChange(e.target.value)}
                  placeholder="Customer Support Agent"
                  autoFocus
                />
              </div>

              {/* Identifier */}
              <div className="space-y-2">
                <Label htmlFor="name">Identifier</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase())}
                  placeholder="customer-support-agent"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground/70">
                  URL-safe identifier used in API calls
                </p>
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Handles customer inquiries and support tickets..."
                  rows={3}
                />
              </div>

              {/* Type */}
              <div className="space-y-3">
                <Label>Prompt Type</Label>
                <Tabs value={type} onValueChange={(v) => handleTypeChange(v as PromptType)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="text" className="gap-1.5">
                      <FileText className="size-3.5" />
                      Text
                    </TabsTrigger>
                    <TabsTrigger value="chat" className="gap-1.5">
                      <MessageSquare className="size-3.5" />
                      Chat
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground/70">
                  {type === "text"
                    ? "Single text template with {{variables}}"
                    : "Array of role-based messages (system, user, assistant)"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Content Editor - fills height, Monaco handles internal scroll */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Content Header - matches detail page version info bar style */}
          <div className="flex shrink-0 items-center justify-between border-b bg-background/30 px-4 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold tracking-tight text-muted-foreground">CONTENT</span>
              <span className="text-xs text-muted-foreground/70">
                Use {"{{variable}}"} syntax for template variables
              </span>
            </div>
          </div>
          <PromptContentEditor
            type={type}
            content={content}
            onChange={setContent}
            className="min-h-0 flex-1"
          />
        </div>
      </div>
    </div>
  );
}

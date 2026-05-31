/**
 * Prompt Content Editor
 *
 * Editor for prompt content - simple textarea for text type,
 * message builder for chat type.
 *
 * @module features/prompts/components/prompt-content-editor
 */

import { Button } from "@/shared/components/ui/button";
import { MonacoMarkdownEditor } from "@/shared/components/ui/monaco";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import type { PromptChatMessage, PromptContent, PromptType } from "@journey/schemas";
import { Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, useRef } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface PromptContentEditorProps {
  type: PromptType;
  content: PromptContent;
  onChange: (content: PromptContent) => void;
  readOnly?: boolean;
  className?: string;
  /** Fill container height instead of auto-sizing (default: true for detail pages) */
  fillContainer?: boolean;
  /** Apply rounded corners to editor (default: false) */
  rounded?: boolean;
}

// =============================================================================
// TEXT EDITOR
// =============================================================================

interface TextEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  fillContainer?: boolean;
  rounded?: boolean;
}

const TextEditor = memo(function TextEditor({ content, onChange, readOnly, fillContainer = true, rounded = false }: TextEditorProps) {
  return (
    <MonacoMarkdownEditor
      value={content}
      onChange={onChange}
      placeholder="Enter your prompt template here...

Use {{variableName}} for dynamic content."
      wrapperClassName="h-full"
      minHeight={200}
      readOnly={readOnly}
      fillContainer={fillContainer}
      rounded={rounded}
    />
  );
});

// =============================================================================
// CHAT EDITOR
// =============================================================================

interface ChatEditorProps {
  messages: PromptChatMessage[];
  onChange: (messages: PromptChatMessage[]) => void;
  readOnly?: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  system: "border-l-amber-500/60",
  user: "border-l-blue-500/60",
  assistant: "border-l-emerald-500/60",
};

const ChatEditor = memo(function ChatEditor({ messages, onChange, readOnly }: ChatEditorProps) {
  // Ensure all messages have stable IDs (legacy data may not have them)
  // Use useRef to persist generated IDs across renders, preventing key instability
  const generatedIdsRef = useRef<Map<number, string>>(new Map());

  const messagesWithIds = useMemo(() => {
    return messages.map((m, index) => {
      if (m.id) return m;
      // Get or create a stable ID for this index position
      let id = generatedIdsRef.current.get(index);
      if (!id) {
        id = crypto.randomUUID();
        generatedIdsRef.current.set(index, id);
      }
      return { ...m, id };
    });
  }, [messages]);

  const handleRoleChange = useCallback(
    (index: number, role: PromptChatMessage["role"]) => {
      // Use messagesWithIds to preserve stable IDs in the onChange callback
      const updated = messagesWithIds.map((m, i) =>
        i === index ? { ...m, role } : m
      );
      onChange(updated);
    },
    [messagesWithIds, onChange]
  );

  const handleContentChange = useCallback(
    (index: number, content: string) => {
      // Use messagesWithIds to preserve stable IDs in the onChange callback
      const updated = messagesWithIds.map((m, i) =>
        i === index ? { ...m, content } : m
      );
      onChange(updated);
    },
    [messagesWithIds, onChange]
  );

  const handleAddMessage = useCallback(() => {
    onChange([...messagesWithIds, { id: crypto.randomUUID(), role: "user", content: "" }]);
  }, [messagesWithIds, onChange]);

  const handleRemoveMessage = useCallback(
    (index: number) => {
      if (messagesWithIds.length <= 1) return;
      const updated = messagesWithIds.filter((_, i) => i !== index);
      // Clear generated IDs above the removed index since positions shift
      for (let i = index; i < messagesWithIds.length; i++) {
        generatedIdsRef.current.delete(i);
      }
      onChange(updated);
    },
    [messagesWithIds, onChange]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Messages Container - scrollable, tight spacing */}
      <div className="min-h-0 flex-1 space-y-0 overflow-auto">
        {messagesWithIds.map((message, index) => (
          <div
            key={message.id}
            className={cn(
              "border-b border-border/30",
              "border-l-4",
              ROLE_COLORS[message.role] ?? "border-l-muted"
            )}
          >
            {/* Message Header - compact */}
            <div className="flex items-center gap-2 bg-muted/20 px-2 py-1">
              <Select
                value={message.role}
                onValueChange={(v) => handleRoleChange(index, v as PromptChatMessage["role"])}
                disabled={readOnly}
              >
                <SelectTrigger className="h-6 w-24 border-0 bg-transparent text-xs font-medium shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="assistant">Assistant</SelectItem>
                </SelectContent>
              </Select>

              {!readOnly && messagesWithIds.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-5 opacity-40 hover:opacity-100"
                  onClick={() => handleRemoveMessage(index)}
                >
                  <Trash2 className="size-3 text-destructive" />
                </Button>
              )}
            </div>

            {/* Message Content Editor - no padding, scroll disabled for parent container scroll */}
            <MonacoMarkdownEditor
              value={message.content}
              onChange={(value) => handleContentChange(index, value)}
              placeholder={`Enter ${message.role} message...`}
              minHeight={80}
              readOnly={readOnly}
              rounded={false}
              scrollable={false}
            />
          </div>
        ))}
      </div>

      {/* Add Message Button - compact footer */}
      {!readOnly && (
        <div className="shrink-0 border-t border-border/50 bg-muted/20 px-2 py-1.5">
          <Button variant="ghost" size="sm" className="h-7 w-full gap-1.5 text-xs" onClick={handleAddMessage}>
            <Plus className="size-3" />
            Add Message
          </Button>
        </div>
      )}
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const PromptContentEditor = memo(function PromptContentEditor({
  type,
  content,
  onChange,
  readOnly,
  className,
  fillContainer = true,
  rounded = false,
}: PromptContentEditorProps) {
  if (type === "text") {
    return (
      <div className={cn("h-full", className)}>
        <TextEditor
          content={content as string}
          onChange={onChange}
          readOnly={readOnly}
          fillContainer={fillContainer}
          rounded={rounded}
        />
      </div>
    );
  }

  return (
    <div className={cn("h-full", className)}>
      <ChatEditor messages={content as PromptChatMessage[]} onChange={onChange} readOnly={readOnly} />
    </div>
  );
});

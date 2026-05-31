/**
 * MessageContentEditor
 *
 * Reusable text editor with Telegram formatting toolbar and preview mode.
 * Uses TemplateTextarea for template variables autocomplete/highlighting.
 */

import { Label } from "@/shared/components/ui/label";
import { MessageContentPreview } from "@/shared/components/ui/message-content-preview";
import { TemplateTextarea } from "@/shared/components/ui/template-textarea";
import { Toggle } from "@/shared/components/ui/toggle";
import { cn } from "@/shared/lib/utils";
import { Code, Eye } from "lucide-react";
import type { FocusEventHandler, ReactNode } from "react";
import { useRef, useState } from "react";
import { FormattingToolbar, handleFormattingShortcut } from "./formatting-toolbar";

type ViewMode = "code" | "preview";

export interface MessageContentEditorProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  readOnly?: boolean;
  defaultViewMode?: ViewMode;
  className?: string;
  labelClassName?: string;
  textareaClassName?: string;
  previewClassName?: string;
  footer?: ReactNode;
  emptyPreviewText?: string;
  /** Show error styling (red border) */
  hasError?: boolean;
}

export function MessageContentEditor({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  readOnly = false,
  defaultViewMode = "code",
  className,
  labelClassName,
  textareaClassName,
  previewClassName,
  footer,
  emptyPreviewText = "No content. Click to edit.",
  hasError,
}: MessageContentEditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className={cn("text-xs font-medium", labelClassName)}>
          {label}
        </Label>
        <div className="flex items-center gap-0.5 border rounded-md p-0.5 bg-muted/30">
          <Toggle
            size="sm"
            pressed={viewMode === "code"}
            onPressedChange={() => setViewMode("code")}
            className="h-6 px-2 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            aria-label="Code view"
          >
            <Code className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={viewMode === "preview"}
            onPressedChange={() => setViewMode("preview")}
            className="h-6 px-2 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            aria-label="Preview"
          >
            <Eye className="h-3.5 w-3.5" />
          </Toggle>
        </div>
      </div>

      {viewMode === "code" ? (
        <div>
          <FormattingToolbar textareaRef={textareaRef} value={value} onChange={onChange} disabled={readOnly} />
          <TemplateTextarea
            id={id}
            textareaRef={textareaRef}
            value={value}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              handleFormattingShortcut(e, value, onChange);
            }}
            onBlur={onBlur}
            placeholder={placeholder}
            className={cn("min-h-[120px] field-sizing-content text-sm !resize-y", textareaClassName)}
            disabled={readOnly}
            hasError={hasError}
          />
          {footer}
        </div>
      ) : null}

      {/* Keep editor panel visible in preview mode to avoid layout jump */}
      {viewMode === "preview" ? (
        <div>
          <FormattingToolbar textareaRef={textareaRef} value={value} onChange={onChange} disabled />
          <div className="relative rounded-md border border-input overflow-hidden">
            <div className="pointer-events-none invisible">
              <TemplateTextarea
                id={id}
                textareaRef={textareaRef}
                value={value}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  handleFormattingShortcut(e, value, onChange);
                }}
                onBlur={onBlur}
                placeholder={placeholder}
                className={cn("min-h-[120px] field-sizing-content text-sm !border-transparent", textareaClassName)}
                disabled={readOnly}
                hideBackdrop
                readOnly
              />
            </div>

            <div
              className={cn(
                "absolute inset-0 bg-muted/20 p-3 text-sm overflow-auto",
                !value && "flex items-center justify-center text-muted-foreground",
                previewClassName
              )}
              onClick={() => !readOnly && setViewMode("code")}
              role={readOnly ? undefined : "button"}
              tabIndex={readOnly ? undefined : 0}
              aria-label={readOnly ? undefined : "Click to switch to edit mode"}
              onKeyDown={(e) => {
                if (readOnly) return;
                if (e.key === "Enter" || e.key === " ") {
                  setViewMode("code");
                }
              }}
            >
              {value ? (
                  <MessageContentPreview
                    content={value}
                    className="[&>div:not(:first-child)]:!mt-5 [&_p]:!my-0 [&_p]:!leading-5 whitespace-pre-wrap"
                  />
                ) : (
                  <span className="text-xs">{emptyPreviewText}</span>
                )}
            </div>
          </div>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

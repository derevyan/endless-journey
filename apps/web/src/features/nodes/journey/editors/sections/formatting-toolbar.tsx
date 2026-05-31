/**
 * Formatting Toolbar for Telegram HTML tags
 *
 * Provides buttons to wrap selected text with HTML formatting tags
 * used by Telegram: <b>, <i>, <u>, <s>, <code>
 *
 * @module nodes/editors/sections/formatting-toolbar
 */

import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Bold, Code, Italic, Link, Strikethrough, Underline } from "lucide-react";
import type { RefObject } from "react";

interface FormattingToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface FormatButton {
  icon: typeof Bold;
  label: string;
  openTag: string;
  closeTag: string;
  shortcut?: string;
  isLink?: boolean;
}

const FORMAT_BUTTONS: FormatButton[] = [
  { icon: Bold, label: "Bold", openTag: "<b>", closeTag: "</b>", shortcut: "Ctrl+B" },
  { icon: Italic, label: "Italic", openTag: "<i>", closeTag: "</i>", shortcut: "Ctrl+I" },
  { icon: Underline, label: "Underline", openTag: "<u>", closeTag: "</u>", shortcut: "Ctrl+U" },
  { icon: Strikethrough, label: "Strikethrough", openTag: "<s>", closeTag: "</s>" },
  { icon: Code, label: "Code", openTag: "<code>", closeTag: "</code>" },
  { icon: Link, label: "Link", openTag: '<a href="">', closeTag: "</a>", isLink: true },
];

/**
 * Wrap selected text with HTML tags
 */
function wrapSelection(
  textarea: HTMLTextAreaElement,
  openTag: string,
  closeTag: string,
  value: string,
  onChange: (v: string) => void
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = value.substring(start, end);

  const before = value.substring(0, start);
  const after = value.substring(end);

  // If no selection, insert tags with cursor between them
  if (start === end) {
    const newValue = `${before}${openTag}${closeTag}${after}`;
    onChange(newValue);

    // Position cursor between tags
    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + openTag.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  } else {
    // Wrap selected text
    const newValue = `${before}${openTag}${selectedText}${closeTag}${after}`;
    onChange(newValue);

    // Select the wrapped text (including tags)
    setTimeout(() => {
      textarea.focus();
      const newStart = start;
      const newEnd = start + openTag.length + selectedText.length + closeTag.length;
      textarea.setSelectionRange(newStart, newEnd);
    }, 0);
  }
}

/**
 * Insert a link with URL prompt
 */
function insertLink(
  textarea: HTMLTextAreaElement,
  value: string,
  onChange: (v: string) => void
) {
  const url = window.prompt("Enter URL:");
  if (!url) return; // User cancelled

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = value.substring(start, end) || "link text";

  const before = value.substring(0, start);
  const after = value.substring(end);

  const openTag = `<a href="${url}">`;
  const closeTag = "</a>";

  const newValue = `${before}${openTag}${selectedText}${closeTag}${after}`;
  onChange(newValue);

  // Select the link text for easy editing
  setTimeout(() => {
    textarea.focus();
    const textStart = start + openTag.length;
    const textEnd = textStart + selectedText.length;
    textarea.setSelectionRange(textStart, textEnd);
  }, 0);
}

export function FormattingToolbar({ textareaRef, value, onChange, disabled = false }: FormattingToolbarProps) {
  const handleFormat = (button: FormatButton) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (button.isLink) {
      insertLink(textarea, value, onChange);
    } else {
      wrapSelection(textarea, button.openTag, button.closeTag, value, onChange);
    }
  };

  return (
    <div className="flex items-center gap-0.5 pb-1.5">
      {FORMAT_BUTTONS.map((button) => (
        <Tooltip key={button.label}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => handleFormat(button)}
              disabled={disabled}
            >
              <button.icon className="h-3.5 w-3.5" />
              <span className="sr-only">{button.label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {button.label}
            {button.shortcut && <span className="ml-2 text-muted-foreground">{button.shortcut}</span>}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/**
 * Handle keyboard shortcuts for formatting
 * Call this from onKeyDown on the textarea
 */
export function handleFormattingShortcut(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (v: string) => void
): boolean {
  const textarea = e.currentTarget;

  // Check for Ctrl/Cmd + key combinations
  if (e.ctrlKey || e.metaKey) {
    let openTag = "";
    let closeTag = "";

    switch (e.key.toLowerCase()) {
      case "b":
        openTag = "<b>";
        closeTag = "</b>";
        break;
      case "i":
        openTag = "<i>";
        closeTag = "</i>";
        break;
      case "u":
        openTag = "<u>";
        closeTag = "</u>";
        break;
      default:
        return false;
    }

    if (openTag) {
      e.preventDefault();
      wrapSelection(textarea, openTag, closeTag, value, onChange);
      return true;
    }
  }

  return false;
}

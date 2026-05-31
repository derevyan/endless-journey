/**
 * Monaco Markdown Editor
 *
 * A simple markdown editor using @monaco-editor/react with custom themes.
 * Uses Night Owl (dark) and GitHub Light (light) themes.
 *
 * @module components/ui/monaco/monaco-markdown-editor
 */

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { forwardRef, memo, useCallback, useImperativeHandle, useRef } from "react";
import type * as Monaco from "monaco-editor";

// Configuration and themes
import { DEFAULT_EDITOR_OPTIONS, THEMES } from "./monaco-config";

// Themes (only the 2 used themes - dark and light)
import nightOwlTheme from "./themes/night-owl.json";
import githubLightTheme from "./themes/github-light.json";

// Theme registry
const THEME_DATA: Record<string, unknown> = {
  "night-owl": nightOwlTheme,
  "github-light": githubLightTheme,
};

import { cn } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface MonacoMarkdownEditorProps {
  /** Current content value */
  value: string;
  /** Called when content changes */
  onChange?: (value: string) => void;
  /** Placeholder text shown when empty */
  placeholder?: string;
  /** Make editor read-only */
  readOnly?: boolean;
  /** Additional CSS classes for the editor container */
  className?: string;
  /** CSS classes for the wrapper div */
  wrapperClassName?: string;
  /** Minimum height in pixels (default: 200) */
  minHeight?: number;
  /** ID for the editor element */
  id?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Called on blur */
  onBlur?: () => void;
  /** Apply rounded corners to editor (default: false) */
  rounded?: boolean;
  /** Fill container height instead of auto-sizing to content (default: false) */
  fillContainer?: boolean;
  /** Enable scrolling within editor (default: true). Set to false for editors inside scroll containers */
  scrollable?: boolean;
}

export interface MonacoMarkdownEditorRef {
  /** Focus the editor */
  focus: () => void;
  /** Get the Monaco editor instance */
  getEditor: () => Monaco.editor.IStandaloneCodeEditor | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const MonacoMarkdownEditor = memo(
  forwardRef<MonacoMarkdownEditorRef, MonacoMarkdownEditorProps>(function MonacoMarkdownEditor(
    {
      value,
      onChange,
      placeholder,
      readOnly = false,
      className,
      wrapperClassName,
      minHeight = 200,
      id,
      disabled = false,
      onBlur,
      rounded = false,
      fillContainer = false,
      scrollable = true,
    },
    ref
  ) {
    const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Theme handling
    const { resolvedTheme } = useTheme();
    const monacoTheme = resolvedTheme === "light" ? THEMES.light : THEMES.dark;

    // Register custom themes before editor mounts
    const handleBeforeMount: BeforeMount = useCallback((monaco) => {
      // Register all available themes
      Object.entries(THEME_DATA).forEach(([name, data]) => {
        monaco.editor.defineTheme(name, data as Monaco.editor.IStandaloneThemeData);
      });
    }, []);

    // Expose ref methods
    useImperativeHandle(ref, () => ({
      focus: () => editorRef.current?.focus(),
      getEditor: () => editorRef.current,
    }));

    // Handle editor mount
    const handleEditorMount: OnMount = useCallback((editor) => {
      editorRef.current = editor;

      // Auto-height mode: update container height directly via DOM
      // This is synchronous, avoiding the React state delay that causes jumping
      // See: https://github.com/microsoft/monaco-editor/issues/794
      if (!fillContainer) {
        const updateHeight = () => {
          const contentHeight = editor.getContentHeight();
          const newHeight = Math.max(minHeight, contentHeight);

          // Direct DOM update - synchronous, no React delay
          if (containerRef.current) {
            containerRef.current.style.height = `${newHeight}px`;
          }

          // Tell Monaco to re-layout with new size
          editor.layout();
        };

        // Update on content size change (handles word wrap, decorations, etc.)
        editor.onDidContentSizeChange(updateHeight);

        // Initial height
        updateHeight();
      }

      // Handle blur
      editor.onDidBlurEditorText(() => {
        onBlur?.();
      });
    }, [onBlur, minHeight, fillContainer]);

    // Handle content changes
    const handleChange = useCallback((value: string | undefined) => {
      onChange?.(value ?? "");
    }, [onChange]);

    // Show placeholder when empty
    const showPlaceholder = !value && placeholder;

    return (
      <div className={cn("relative", fillContainer && "h-full", wrapperClassName)}>
        <div
          ref={containerRef}
          id={id}
          className={cn(
            "w-full overflow-hidden",
            rounded && "rounded-md",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
          style={{ height: fillContainer ? "100%" : minHeight }}
        >
          <Editor
            value={value}
            onChange={handleChange}
            beforeMount={handleBeforeMount}
            onMount={handleEditorMount}
            language="markdown"
            theme={monacoTheme}
            height="100%"
            options={{
              ...DEFAULT_EDITOR_OPTIONS,
              readOnly: readOnly || disabled,
              // When scrollable=false, disable all scroll handling so wheel events pass to parent
              ...(scrollable ? {} : {
                scrollbar: {
                  vertical: "hidden",
                  horizontal: "hidden",
                  handleMouseWheel: false,
                },
                overviewRulerLanes: 0,
              }),
            }}
          />
        </div>

        {showPlaceholder && (
          <div
            className="pointer-events-none absolute top-0 left-12 text-sm text-muted-foreground/50"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {placeholder}
          </div>
        )}
      </div>
    );
  })
);

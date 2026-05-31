/**
 * JSON Template Language Support for CodeMirror
 *
 * Extends the standard JSON language with support for {{variable}} syntax
 * within string values. Template variables are highlighted distinctly.
 *
 * @module components/ui/codemirror/languages/json-template
 */

import { json } from "@codemirror/lang-json";
import { LanguageSupport } from "@codemirror/language";
import { Extension } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

// =============================================================================
// TEMPLATE VARIABLE HIGHLIGHTING
// =============================================================================

/**
 * Decoration for template variables within JSON strings
 */
const templateVariableDecoration = Decoration.mark({
  class: "cm-template-variable",
});

/**
 * Find all template variables ({{...}}) in the document and create decorations
 */
function findTemplateVariables(view: EditorView): DecorationSet {
  const decorations: { from: number; to: number }[] = [];
  const text = view.state.doc.toString();
  const regex = /\{\{[^}]*\}\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    decorations.push({
      from: match.index,
      to: match.index + match[0].length,
    });
  }

  return Decoration.set(
    decorations.map(({ from, to }) => templateVariableDecoration.range(from, to))
  );
}

/**
 * ViewPlugin that highlights template variables in JSON
 */
const templateVariablePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = findTemplateVariables(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = findTemplateVariables(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * Theme extension for template variable styling
 */
const templateVariableTheme = EditorView.baseTheme({
  ".cm-template-variable": {
    color: "#0284c7", // sky-600
    fontWeight: "500",
  },
  ".dark .cm-template-variable": {
    color: "#38bdf8", // sky-400
  },
});

// =============================================================================
// JSON LANGUAGE EXTENSION
// =============================================================================

/**
 * Create JSON language support with template variable highlighting
 *
 * @example
 * ```tsx
 * const { containerRef } = useCodeMirror({
 *   value: jsonString,
 *   onChange,
 *   language: jsonTemplateLanguage(),
 * });
 * ```
 */
export function jsonTemplateLanguage(): LanguageSupport {
  return json();
}

/**
 * Extension that adds template variable highlighting to any editor
 * Use this in combination with jsonTemplateLanguage() or standalone
 */
export function templateVariableHighlighting(): Extension {
  return [templateVariablePlugin, templateVariableTheme];
}

/**
 * Complete JSON with template support (language + highlighting)
 */
export function jsonWithTemplates(): Extension[] {
  return [json(), templateVariablePlugin, templateVariableTheme];
}

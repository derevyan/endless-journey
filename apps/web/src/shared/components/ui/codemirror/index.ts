/**
 * CodeMirror Component Library
 *
 * Reusable CodeMirror-based editors for the Journey Builder.
 *
 * @module components/ui/codemirror
 */

// Editors
export { ExpressionEditor, type ExpressionEditorProps } from "./editors/expression-editor";
export { JsonEditor, type JsonEditorProps } from "./editors/json-editor";

// Languages
export { jexlLanguage, jexlLanguageDef } from "./languages/jexl";
export { jsonTemplateLanguage, jsonWithTemplates, templateVariableHighlighting } from "./languages/json-template";

// Extensions
export { createVariableAutocomplete, emptyVariableAutocomplete } from "./extensions/variable-autocomplete";

// Core
export { useCodeMirror, focusEditor, getCursorPosition, insertAtCursor, type UseCodeMirrorOptions, type UseCodeMirrorReturn } from "./use-codemirror";

// Theme
export { baseTheme, lightTheme, darkTheme, getThemeExtension } from "./theme";

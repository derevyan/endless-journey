/**
 * Shared frontend descriptor types for node systems.
 */

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Form behavior configuration shared by node editors.
 */
export interface NodeFormConfig {
  /** Enable auto-save behavior */
  autoSave: boolean;
  /** Optional debounce for auto-save */
  saveDebounceMs?: number;
}

/**
 * Base UI descriptor shared across journey and workflow nodes.
 */
export interface FrontendDescriptorBase<
  TComponentProps,
  TEditorProps,
  TFormConfig extends NodeFormConfig = NodeFormConfig
> {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Visual React component rendered on the canvas */
  component: ComponentType<TComponentProps>;
  /** Config panel editor component */
  editor?: ComponentType<TEditorProps>;
  /** Form behavior configuration */
  formConfig?: TFormConfig;
}

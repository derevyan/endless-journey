import { AUDIO_CONFIG, getEssentialModelIds } from "@journey/schemas";
import type { ToasterProps } from "sonner";

type AppMetadata = {
  name: string;
  version: string;
  defaultTitle: string;
};

type StorageKeys = {
  theme: string;
  customJourneys: string;
  versionHistory: string;
};

type ToastConfig = {
  position: ToasterProps["position"];
  duration: number;
  closeButton: boolean;
  gap: number;
  visibleToasts: number;
};

type UiConfig = {
  toast: ToastConfig;
  zIndex: {
    canvas: number;
    panel: number;
    modal: number;
    toast: number;
  };
};

type TimeoutConfig = {
  autoSaveDebounce: number;
  loadingDelay: number;
  toastDuration: number;
};

type SimulatorConfig = {
  playback: {
    defaultSpeed: number;
  };
  sse: {
    /** Connection timeout in milliseconds */
    connectTimeoutMs: number;
    /** Maximum reconnection attempts before giving up */
    maxReconnectAttempts: number;
    /** Initial reconnection delay (doubles with each attempt) */
    initialReconnectDelayMs: number;
  };
};

type CanvasConfig = {
  /** Enable edge animations (continuous CSS dash animations). Warning: Can cause high CPU usage */
  edgeAnimations: boolean;
  /** Default edge connection style for new users */
  defaultEdgeStyle: "default" | "straight" | "step" | "smoothstep";
  /** Enable journey validation on save */
  validateOnSave: boolean;
  /** Enable edge editing panel (guards, fallback). When false, edges cannot be selected/edited */
  edgeEditable: boolean;
  /** Node types to exclude from the node selector panel (e.g., deprecated nodes) */
  excludedNodeTypes: readonly string[];
};

type EditorConfig = {
  width: string; // Editor panel width (Tailwind class)
  padding: {
    main: string; // Main level sections (Media, Tags, Variables, Metadata, Advanced)
    nested: string; // Nested level sections (scope sections, Available preview)
  };
};

type TagConfig = {
  availableColors: readonly string[];
};

type ApiConfig = {
  url: string;
};

type AudioConfig = {
  /** Default voice for TTS */
  defaultVoice: string;
  /** Available voices for TTS */
  availableVoices: readonly string[];
  /** Maximum recording duration in ms */
  maxRecordingDuration: number;
  /** Enable TTS by default */
  ttsEnabledByDefault: boolean;
};

type ModelsConfig = {
  /**
   * Whitelist of allowed model IDs.
   * Only these models will appear in selectors.
   * Empty array = show all models (no filtering).
   */
  allowedModelIds: readonly string[];
};

export type AppConfig = {
  app: AppMetadata;
  storage: StorageKeys;
  ui: UiConfig;
  timeouts: TimeoutConfig;
  simulator: SimulatorConfig;
  canvas: CanvasConfig;
  editor: EditorConfig;
  tags: TagConfig;
  api: ApiConfig;
  audio: AudioConfig;
  models: ModelsConfig;
};

const app: AppMetadata = {
  name: "Journey Builder",
  version: "0.3.0",
  defaultTitle: "Journey",
};

const storage: StorageKeys = {
  theme: "journey-theme",
  customJourneys: "journey-custom-journeys",
  versionHistory: "journey-versions-",
};

const toast: ToastConfig = {
  position: "top-center",
  duration: 4000,
  closeButton: false, // Close button is handled in notify.tsx custom content
  gap: 12,
  visibleToasts: 3,
};

const ui: UiConfig = {
  toast,
  zIndex: {
    canvas: 0,
    panel: 100,
    modal: 200,
    toast: 300,
  },
};

const timeouts: TimeoutConfig = {
  autoSaveDebounce: 1000,
  loadingDelay: 200,
  toastDuration: toast.duration,
};

const simulator: SimulatorConfig = {
  playback: {
    defaultSpeed: 5,
  },
  sse: {
    connectTimeoutMs: 10000, // 10 seconds
    maxReconnectAttempts: 5,
    initialReconnectDelayMs: 1000, // 1 second
  },
};

const canvas: CanvasConfig = {
  // Edge animations disabled by default - continuous CSS animations can cause 80%+ CPU usage
  edgeAnimations: false,
  // Default edge style for new users - smoothstep provides cleaner visual appearance
  defaultEdgeStyle: "smoothstep",
  // Validate journey structure on save (checks for missing connections, invalid nodes, etc.)
  validateOnSave: true,
  // Enable edge editing panel - allows users to configure guards and fallback edges
  edgeEditable: true,
  // Node types to exclude from selector panel - CRM functionality available as crmAction on any node
  excludedNodeTypes: ["crm"] as const,
};

const editor: EditorConfig = {
  width: "w-[440px]", // Editor panel width (15% wider than original w-96 = 384px)
  padding: {
    main: "pl-3", // 12px padding for main level sections
    nested: "pl-2", // 8px padding for nested level sections
  },
};

// Static color-to-class mapping ensures Tailwind JIT can detect all bg-* classes at build time
export const TAG_COLOR_MAP: Record<string, string> = {
  "slate-500": "bg-slate-500",
  "red-500": "bg-red-500",
  "orange-500": "bg-orange-500",
  "amber-500": "bg-amber-500",
  "yellow-500": "bg-yellow-500",
  "lime-500": "bg-lime-500",
  "green-500": "bg-green-500",
  "emerald-500": "bg-emerald-500",
  "teal-500": "bg-teal-500",
  "cyan-500": "bg-cyan-500",
  "sky-500": "bg-sky-500",
  "blue-500": "bg-blue-500",
  "indigo-500": "bg-indigo-500",
  "violet-500": "bg-violet-500",
  "purple-500": "bg-purple-500",
  "fuchsia-500": "bg-fuchsia-500",
  "pink-500": "bg-pink-500",
  "rose-500": "bg-rose-500",
} as const;

const tags: TagConfig = {
  availableColors: Object.keys(TAG_COLOR_MAP) as readonly string[],
};

const api: ApiConfig = {
  url: import.meta.env.VITE_API_URL || "http://localhost:3001",
};

// Audio config - derived from AUDIO_CONFIG in @journey/schemas (single source of truth)
const audio: AudioConfig = {
  defaultVoice: AUDIO_CONFIG.openai.defaultVoice,
  availableVoices: AUDIO_CONFIG.openai.voices.map((v) => v.id),
  maxRecordingDuration: 60000, // 1 minute (web-specific)
  ttsEnabledByDefault: false, // web-specific
};

// Models config - from essential models (single source of truth)
const models: ModelsConfig = {
  allowedModelIds: getEssentialModelIds(),
};

export const appConfig = {
  app,
  storage,
  ui,
  timeouts,
  simulator,
  canvas,
  editor,
  tags,
  api,
  audio,
  models,
} as const satisfies AppConfig;

// Export commonly used constants for convenience
export const TAG_AVAILABLE_COLORS = appConfig.tags.availableColors;
export const API_URL = appConfig.api.url;

/**
 * Colors for entities like pipelines and stages (hex format)
 * Used by NameColorFormDialog and ColorPicker components
 */
export const ENTITY_COLORS = [
  "#6b7280", // gray
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // yellow
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
] as const;

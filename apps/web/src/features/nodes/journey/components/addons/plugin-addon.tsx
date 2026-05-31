/**
 * PluginAddon Component
 *
 * Base wrapper for individual plugin addons that attach to parent nodes.
 * Renders a compact dashed-border container with handles on the right side.
 *
 * This is the universal foundation for all plugin types - each plugin type
 * provides its own content renderer that plugs into this wrapper.
 */

import { Handle, Position } from "@xyflow/react";
import { memo, type ReactNode } from "react";

import { FOCUS_STYLES, HANDLE_STYLES, TRANSITIONS } from "../../config/node-theme";

/**
 * Handle configuration for plugin addons
 */
export interface AddonHandle {
  id: string;
  label: string;
  type: "button" | "exit";
}

/**
 * Styling constants for plugin addons - consistent violet theme
 */
/**
 * Styling constants for plugin addons - consistent Amber theme
 */
export const ADDON_STYLES = {
  container: {
    shape: "rounded-lg",
    border: "border border-dashed transition-all duration-200",
    padding: "px-3 py-2",
    background: "bg-amber-500/5 backdrop-blur-[2px]",
    margin: "mt-4", // Increased top margin for better separation from node badges
    animation: "animate-in slide-in-from-top-2 fade-in zoom-in-95 duration-200",
  },
  colors: {
    border: {
      default: "border-amber-400/40 dark:border-amber-500/30",
      hover: "hover:border-amber-500/80 hover:bg-amber-500/10",
      selected: "border-amber-500 bg-amber-500/15 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
    },
    handle: {
      button: "#f59e0b", // amber-500
      exit: "#94a3b8", // slate-400
    },
  },
} as const;

interface PluginAddonProps {
  pluginId: string;
  isEditMode: boolean;
  isSelected?: boolean;
  handles: AddonHandle[];
  onClick?: () => void;
  children: ReactNode;
}

export const PluginAddon = memo(function PluginAddon({ pluginId, isEditMode: _isEditMode, isSelected = false, handles, onClick, children }: PluginAddonProps) {
  return (
    <div className="group relative">
      {/* 
        Visual Link/Connector 
        This is the "physical" bracket connecting parent to plugin
      */}

      <div
        role="button"
        tabIndex={0}
        aria-label={`Plugin addon: ${pluginId}`}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            onClick?.();
          }
        }}
        className={`
          relative ${ADDON_STYLES.container.padding} ${ADDON_STYLES.container.shape}
          ${ADDON_STYLES.container.border} ${ADDON_STYLES.container.background}
          ${ADDON_STYLES.container.margin} ${ADDON_STYLES.container.animation}
          ${TRANSITIONS.default} ${FOCUS_STYLES.ring}
          cursor-pointer
          ${isSelected ? ADDON_STYLES.colors.border.selected : `${ADDON_STYLES.colors.border.default} ${ADDON_STYLES.colors.border.hover}`}
          active:scale-[0.98]
          hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/5
        `}
      >
        {/* Plugin content (icon, title, badges, etc.) */}
        {children}

        {/* Source handles for button/exit connections (right side) */}
        {handles.map((handle, index) => {
          const total = handles.length;
          const topPercent = total === 1 ? 50 : 20 + (index * 60) / (total - 1);
          const color = handle.type === "exit" ? ADDON_STYLES.colors.handle.exit : ADDON_STYLES.colors.handle.button;

          return (
            <Handle
              key={handle.id}
              type="source"
              position={Position.Right}
              id={handle.id}
              className={`${HANDLE_STYLES.size} ${HANDLE_STYLES.border} ${HANDLE_STYLES.hidden}`}
              style={{
                top: `${topPercent}%`,
                backgroundColor: color,
                right: "-6px",
              }}
            />
          );
        })}
      </div>
    </div>
  );
});

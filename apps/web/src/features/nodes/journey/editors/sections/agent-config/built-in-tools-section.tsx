/**
 * Built-in Tools Section
 *
 * Shared component for configuring agent built-in tools.
 * Used by both journey agent editor and workflow agent config.
 *
 * @module features/nodes/journey/editors/sections/agent-config/built-in-tools-section
 */

import { Label } from "@/shared/components/ui/label";
import { ToolToggle } from "@/shared/components/ui/tool-toggle";
import { ArrowRightCircle, Brain, Braces, MessageSquare, Route, User, UserCog } from "lucide-react";
import type { BuiltInToolsConfig } from "./types";

/**
 * Props for BuiltInToolsSection component
 */
export interface BuiltInToolsSectionProps {
  /** Current tool configuration */
  config: BuiltInToolsConfig;
  /** Callback when a tool setting changes */
  onConfigChange: (key: keyof BuiltInToolsConfig, value: boolean) => void;
  /** Unique ID prefix for toggle components */
  idPrefix: string;
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Show write user variable tool (workflow-specific) */
  showWriteUserVariable?: boolean;
  /** Show mindstate parameters tool (journey-specific) */
  showMindstateParameters?: boolean;
}

/**
 * Built-in Tools Section Content
 *
 * Renders the data access and communication tool toggles.
 * Does NOT include wrapping CollapsibleSection - that's the parent's responsibility.
 */
export function BuiltInToolsSection({
  config,
  onConfigChange,
  idPrefix,
  disabled,
  showWriteUserVariable = false,
  showMindstateParameters = false,
}: BuiltInToolsSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Configure what the agent can access and do</p>

      {/* Data Access Group */}
      <div className="space-y-2">
        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Data Access</Label>
        <div className="space-y-1 border rounded-md p-3">
          <ToolToggle
            id={`${idPrefix}-getUserProfile`}
            icon={User}
            label="User Profile"
            description="Access client data (name, email, tags)"
            checked={config.getUserProfile ?? true}
            onChange={(v) => onConfigChange("getUserProfile", v)}
            disabled={disabled}
          />
          <ToolToggle
            id={`${idPrefix}-getJourneyContext`}
            icon={Route}
            label="Journey Context"
            description="Access current journey state"
            checked={config.getJourneyContext ?? true}
            onChange={(v) => onConfigChange("getJourneyContext", v)}
            disabled={disabled}
          />
          <ToolToggle
            id={`${idPrefix}-readJourneyVariables`}
            icon={Braces}
            label="Journey Variables"
            description="Read journey-scoped variables"
            checked={(config.readJourneyVariables ?? config.readJourneyVariable) ?? false}
            onChange={(v) => onConfigChange("readJourneyVariables", v)}
            disabled={disabled}
          />
          <ToolToggle
            id={`${idPrefix}-readUserVariables`}
            icon={UserCog}
            label="User Variables"
            description="Read user profile variables"
            checked={(config.readUserVariables ?? config.readUserVariable) ?? false}
            onChange={(v) => onConfigChange("readUserVariables", v)}
            disabled={disabled}
          />
          {showWriteUserVariable && (
            <ToolToggle
              id={`${idPrefix}-writeUserVariable`}
              icon={UserCog}
              label="Write User Variables"
              description="Modify user profile variables"
              checked={config.writeUserVariable ?? false}
              onChange={(v) => onConfigChange("writeUserVariable", v)}
              disabled={disabled}
            />
          )}
          {showMindstateParameters && (
            <ToolToggle
              id={`${idPrefix}-readMindstateParameters`}
              icon={Brain}
              label="Mindstate Parameters"
              description="Read mindstate flow parameters"
              checked={config.readMindstateParameters ?? false}
              onChange={(v) => onConfigChange("readMindstateParameters", v)}
              disabled={disabled}
            />
          )}
        </div>
      </div>

      {/* Communication Group */}
      <div className="space-y-2">
        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Communication</Label>
        <div className="space-y-1 border rounded-md p-3">
          <ToolToggle
            id={`${idPrefix}-sendMessage`}
            icon={MessageSquare}
            label="Send Message"
            description="Allow agent to send messages to user"
            checked={config.sendMessage ?? true}
            onChange={(v) => onConfigChange("sendMessage", v)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Journey Routing Group */}
      <div className="space-y-2">
        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Journey Routing</Label>
        <div className="space-y-1 border rounded-md p-3">
          <ToolToggle
            id={`${idPrefix}-exitToNextNode`}
            icon={ArrowRightCircle}
            label="Exit to Next Node"
            description="Exit agent and transition to next journey node"
            checked={config.exitToNextNode ?? true}
            onChange={(v) => onConfigChange("exitToNextNode", v)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

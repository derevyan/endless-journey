/**
 * TimerSection Component
 *
 * Reusable collapsible section for timer configuration in node editors.
 * Used by MessageNodeEditor for follow-up timers.
 *
 * Self-registers with sectionRegistry for dynamic section discovery.
 */

import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { useEditorSectionsContext } from "../editor-sections-context";
import { Clock } from "lucide-react";

import { DurationInput } from "./duration-input";
import { sectionRegistry, SectionOrder, type SectionDefinition, type SectionProps } from "../../registry/section-registry";

interface TimerSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Field prefix for duration fields (e.g., "timer" for timerDays, timerHours, etc.) */
  fieldPrefix?: string;
  /** Description text shown below the section header */
  description?: string;
  /** Additional help text shown below the duration input */
  helpText?: string;
}

/**
 * Collapsible timer configuration section for node editors.
 *
 * @example
 * ```tsx
 * <TimerSection
 *   open={timerOpen}
 *   onOpenChange={setTimerOpen}
 *   fieldPrefix="timer"
 *   description="Set a timer for follow-up if user doesn't respond."
 * />
 * ```
 */
export function TimerSection({
  open,
  onOpenChange,
  fieldPrefix = "timer",
  description = "Set a timer for follow-up if user doesn't respond. Leave empty to disable.",
  helpText = "Timer triggers the timeout edge when the user doesn't interact within the specified time.",
}: TimerSectionProps) {
  const { form, nodeId, readOnly } = useEditorSectionsContext();

  return (
    <CollapsibleSection open={open} onOpenChange={onOpenChange} icon={Clock} label="Timer">
      <p className="text-xs text-muted-foreground">{description}</p>
      <DurationInput nodeId={nodeId} fieldPrefix={fieldPrefix} form={form} readOnly={readOnly} />
      <p className="text-[10px] text-muted-foreground">{helpText}</p>
    </CollapsibleSection>
  );
}

// =============================================================================
// SELF-REGISTRATION
// =============================================================================

/**
 * Adapter component that bridges SectionProps to TimerSectionProps.
 * Used by the registry for dynamic section rendering.
 */
function TimerSectionAdapter(props: SectionProps) {
  // These are required for capability-based sections
  if (props.open === undefined || props.onOpenChange === undefined) {
    throw new Error("TimerSectionAdapter requires open and onOpenChange props");
  }
  return <TimerSection open={props.open} onOpenChange={props.onOpenChange} />;
}

/**
 * Timer section definition for registry.
 */
export const timerSectionDefinition = {
  id: "timer",
  label: "Timer",
  icon: Clock,
  order: SectionOrder.TIMER,
  shouldRender: (_node, caps) => caps.hasTimer === true,
  component: TimerSectionAdapter,
} as const satisfies SectionDefinition;

// Self-register on import
sectionRegistry.register(timerSectionDefinition);

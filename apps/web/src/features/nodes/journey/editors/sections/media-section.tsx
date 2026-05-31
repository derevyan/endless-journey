/**
 * MediaSection Component
 *
 * Reusable collapsible section for media attachments in node editors.
 * Used by StartNodeEditor and MessageNodeEditor.
 *
 * Automatically fetches journeyId from context when not provided.
 * Self-registers with sectionRegistry for dynamic section discovery.
 */

import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { MediaUpload } from "@/shared/components/ui/media-upload";
import { useNodeEditorContext } from "../../hooks/use-node-editor-context";
import { useEditorSectionsContext } from "../editor-sections-context";
import type { Media } from "@journey/schemas";
import { ImageIcon } from "lucide-react";
import { sectionRegistry, SectionOrder, type SectionDefinition, type SectionProps } from "../../registry/section-registry";

interface MediaSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Journey ID for media upload (optional, fetched from context if not provided) */
  journeyId?: string | null;
  /** Description text shown below the section header */
  description?: string;
}

/**
 * Collapsible media attachment section for node editors.
 *
 * @example
 * ```tsx
 * // Minimal - journeyId fetched from context
 * <MediaSection
 *   open={mediaOpen}
 *   onOpenChange={setMediaOpen}
 * />
 *
 * // With custom description
 * <MediaSection
 *   open={mediaOpen}
 *   onOpenChange={setMediaOpen}
 *   description="Attach an image or video to send with the welcome message."
 * />
 * ```
 */
export function MediaSection({
  open,
  onOpenChange,
  journeyId: journeyIdProp,
  description = "Attach an image or video to send with this message.",
}: MediaSectionProps) {
  const { form, readOnly } = useEditorSectionsContext();
  const nodeEditorCtx = useNodeEditorContext();

  const journeyId = journeyIdProp ?? nodeEditorCtx.journeyUuid;

  return (
    <CollapsibleSection open={open} onOpenChange={onOpenChange} icon={ImageIcon} label="Media">
      <p className="text-xs text-muted-foreground">{description}</p>
      <form.Field name="media">
        {(field: { state: { value: Media | null | undefined }; handleChange: (value: Media | null) => void }) => (
          <MediaUpload
            value={field.state.value}
            onChange={(media) => field.handleChange(media)}
            journeyId={journeyId ?? undefined}
            disabled={readOnly}
          />
        )}
      </form.Field>
    </CollapsibleSection>
  );
}

// =============================================================================
// SELF-REGISTRATION
// =============================================================================

/**
 * Adapter component that bridges SectionProps to MediaSectionProps.
 * Used by the registry for dynamic section rendering.
 */
function MediaSectionAdapter(props: SectionProps) {
  // These are required for capability-based sections
  if (props.open === undefined || props.onOpenChange === undefined) {
    throw new Error("MediaSectionAdapter requires open and onOpenChange props");
  }
  return <MediaSection open={props.open} onOpenChange={props.onOpenChange} />;
}

/**
 * Media section definition for registry.
 */
export const mediaSectionDefinition = {
  id: "media",
  label: "Media",
  icon: ImageIcon,
  order: SectionOrder.MEDIA,
  shouldRender: (_node, caps) => caps.hasMedia === true,
  component: MediaSectionAdapter,
} as const satisfies SectionDefinition;

// Self-register on import
sectionRegistry.register(mediaSectionDefinition);

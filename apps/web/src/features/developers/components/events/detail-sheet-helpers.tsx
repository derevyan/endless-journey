/**
 * Detail Sheet Helper Components
 *
 * Shared UI components for event and activity detail sheets.
 *
 * @module components/developers/events/detail-sheet-helpers
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for Section component
 */
interface SectionProps {
  /** Section title displayed as header */
  title: string;
  /** Optional action element (e.g., copy button) displayed on the right */
  action?: React.ReactNode;
  /** Optional icon displayed before the title */
  icon?: React.ReactNode;
  /** Section content */
  children: React.ReactNode;
}

/**
 * Props for InfoRow component
 */
interface InfoRowProps {
  /** Label displayed on the left */
  label: string;
  /** Value content displayed on the right */
  children: React.ReactNode;
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Section component for grouping related information in detail sheets.
 * Displays a title with optional icon and action, followed by content.
 */
export function Section({ title, action, icon, children }: SectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        </div>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/**
 * InfoRow component for displaying label-value pairs in detail sheets.
 * Renders label on the left and content on the right.
 */
export function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="text-sm text-right">{children}</div>
    </div>
  );
}

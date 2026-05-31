/**
 * Settings Dialog
 *
 * Reusable dialog layout with sidebar navigation for settings pages.
 * Based on shadcn/ui patterns with sidebar navigation.
 *
 * @module components/ui/settings-dialog
 */

import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/shared/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface SettingsNavItem {
  id: string;
  name: string;
  icon: LucideIcon;
}

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  navItems: SettingsNavItem[];
  activeItem: string;
  onItemChange: (id: string) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

// =============================================================================
// CONTEXT
// =============================================================================

interface SettingsDialogContextValue {
  activeItem: string;
}

const SettingsDialogContext = React.createContext<SettingsDialogContextValue | null>(null);

function useSettingsDialog() {
  const context = React.useContext(SettingsDialogContext);
  if (!context) {
    throw new Error("useSettingsDialog must be used within a SettingsDialog");
  }
  return context;
}

// =============================================================================
// LAYOUT COMPONENT
// =============================================================================

interface SettingsLayoutProps {
  title: string;
  navItems: SettingsNavItem[];
  activeItem: string;
  onItemChange: (id: string) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

function SettingsLayout({
  title,
  navItems,
  activeItem,
  onItemChange,
  children,
  footer,
  className,
}: SettingsLayoutProps) {
  const activeNavItem = navItems.find((item) => item.id === activeItem);

  return (
    <SettingsDialogContext.Provider value={{ activeItem }}>
      <div className={cn("flex min-h-0 flex-1", className)}>
        {/* Sidebar Navigation */}
        <nav className="hidden w-48 shrink-0 flex-col border-r bg-muted/20 md:flex">
          <div className="flex-1 overflow-y-auto py-2">
            <ul className="flex flex-col gap-0.5 px-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === activeItem;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onItemChange(item.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        isActive && "bg-accent text-accent-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex min-h-0 flex-1 flex-col">
          {/* Header with Breadcrumb */}
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <span className="text-muted-foreground">{title}</span>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{activeNavItem?.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          {/* Content Area - scrollable */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>

          {/* Footer */}
          {footer && <div className="flex items-center justify-end gap-2 border-t bg-muted/10 px-4 py-3">{footer}</div>}
        </main>
      </div>
    </SettingsDialogContext.Provider>
  );
}

// =============================================================================
// MAIN COMPONENTS
// =============================================================================

function SettingsDialog({ open, onOpenChange, title, description, navItems, activeItem, onItemChange, children, footer, className }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("flex h-[85vh] max-h-[700px] flex-col overflow-hidden p-0 md:max-w-[900px] lg:max-w-[1000px]", className)}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description && <DialogDescription className="sr-only">{description}</DialogDescription>}
        <SettingsLayout
          title={title}
          navItems={navItems}
          activeItem={activeItem}
          onItemChange={onItemChange}
          footer={footer}
        >
          {children}
        </SettingsLayout>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// CONTENT COMPONENT
// =============================================================================

interface SettingsContentProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

function SettingsContent({ id, children, className }: SettingsContentProps) {
  const { activeItem } = useSettingsDialog();

  if (activeItem !== id) {
    return null;
  }

  return <div className={cn("space-y-4", className)}>{children}</div>;
}

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

interface SettingsSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

function SettingsSection({ title, description, children, className }: SettingsSectionProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

function SettingsRow({ label, description, children, className }: SettingsRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="space-y-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { SettingsContent, SettingsDialog, SettingsRow, SettingsSection, useSettingsDialog };

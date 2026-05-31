/**
 * Content Section
 *
 * Wrapper component for settings page content sections.
 * Provides consistent styling with title, description, and scrollable content area.
 *
 * @module components/settings/content-section
 */

import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Separator } from "@/shared/components/ui/separator";
import { cn } from "@/shared/lib/utils";

interface ContentSectionProps {
  title: string;
  desc: string;
  children: React.ReactNode;
  className?: string;
}

export function ContentSection({ title, desc, children, className }: ContentSectionProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-none">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground text-sm">{desc}</p>
      </div>
      <Separator className="mt-4 flex-none" />
      <ScrollArea className="faded-bottom -mx-4 flex-1 scroll-smooth px-4 md:pb-16">
        <div className={cn("-mx-1 px-1.5 pt-4 lg:max-w-xl", className)}>{children}</div>
      </ScrollArea>
    </div>
  );
}


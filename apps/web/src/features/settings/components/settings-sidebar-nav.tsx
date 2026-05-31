/**
 * Settings Sidebar Navigation
 *
 * Left sidebar navigation for settings pages.
 * Adapted for TanStack Router with mobile dropdown support.
 *
 * @module components/settings/settings-sidebar-nav
 */

import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";

import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

export interface SettingsNavItem {
  href: string;
  title: string;
  icon: LucideIcon;
}

interface SettingsSidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: SettingsNavItem[];
}

export function SettingsSidebarNav({ className, items, ...props }: SettingsSidebarNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [val, setVal] = useState(pathname ?? "/settings");

  const handleSelect = (value: string) => {
    setVal(value);
    navigate({ to: value });
  };

  return (
    <>
      {/* Mobile: Dropdown Select */}
      <div className="p-1 md:hidden">
        <Select value={val} onValueChange={handleSelect}>
          <SelectTrigger className="h-10 sm:w-48">
            <SelectValue placeholder="Select section" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.href} value={item.href}>
                <div className="flex gap-x-4 px-2 py-0.5">
                  <span className="scale-125 [&_svg]:size-[1.125rem]">
                    <item.icon />
                  </span>
                  <span className="text-md">{item.title}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Sidebar Links */}
      <ScrollArea className="bg-background hidden w-full min-w-48 px-1 py-2 md:block">
        <nav
          className={cn("flex space-x-2 py-1 lg:flex-col lg:space-y-1 lg:space-x-0", className)}
          {...props}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                pathname === item.href
                  ? "bg-muted hover:bg-muted"
                  : "hover:bg-transparent hover:underline",
                "justify-start"
              )}
            >
              <span className="mr-2 [&_svg]:size-[1.125rem]">
                <item.icon />
              </span>
              {item.title}
            </Link>
          ))}
        </nav>
      </ScrollArea>
    </>
  );
}


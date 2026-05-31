/**
 * Navigation Group Component
 *
 * Renders a group of navigation items in the sidebar.
 * Adapted from shadcn-admin for TanStack Router.
 *
 * @module components/dashboard/nav-group
 */

import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/shared/components/ui/sidebar";

import type { NavGroup as NavGroupType, NavItem } from "./sidebar-data";

interface NavGroupProps extends NavGroupType {}

export function NavGroup({ title, items }: NavGroupProps) {
  const { setOpenMobile } = useSidebar();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          // Items without sub-items render as direct links
          if (!item.items) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={checkIsActive(pathname, item, true)} tooltip={item.title}>
                  <Link to={item.url} onClick={() => setOpenMobile(false)}>
                    {item.icon && <item.icon className="size-4 shrink-0" />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          // Items with sub-items render as collapsible
          return (
            <Collapsible key={item.title} asChild defaultOpen={checkIsActive(pathname, item, true)} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title}>
                    {item.icon && <item.icon className="size-4 shrink-0" />}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent className="CollapsibleContent">
                  <SidebarMenuSub>
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild isActive={checkIsActive(pathname, subItem)}>
                          <Link to={subItem.url} onClick={() => setOpenMobile(false)}>
                            {subItem.icon && <subItem.icon className="size-4 shrink-0" />}
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

/**
 * Check if a nav item is active based on current pathname
 */
function checkIsActive(pathname: string, item: NavItem, mainNav = false): boolean {
  // Exact match
  if (pathname === item.url) return true;

  // Match without query params
  if (pathname.split("?")[0] === item.url) return true;

  // Check if any child nav is active
  if (item.items?.some((i) => i.url === pathname)) return true;

  // For main nav items, check if we're in the same section
  if (mainNav && pathname.split("/")[1] !== "" && item.url.split("/")[1] === pathname.split("/")[1]) {
    return true;
  }

  return false;
}


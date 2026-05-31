/**
 * Organisation Switcher Component
 *
 * Displays and allows switching between organisations in the sidebar header.
 * Fetches organisations from Better Auth API and handles active organisation switching.
 *
 * @module components/dashboard/organisation-switcher
 */

import { Building2, Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/shared/components/ui/sidebar";
import { apiClient } from "@/shared/lib/api";
import { authClient } from "@/shared/lib/auth-client";
import { STARTER_JOURNEY_CONFIG, STARTER_JOURNEY_METADATA } from "@/features/journey/builder/lib/journey/starter-journey";
import { createLogger, serializeError } from "@journey/logger";

import { notify } from "@/shared/lib/ui/notify";

// =============================================================================
// LOGGER
// =============================================================================

const log = createLogger("organisation-switcher");

// =============================================================================
// COMPONENT
// =============================================================================

export function OrganisationSwitcher() {
  const { isMobile } = useSidebar();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [newOrgName, setNewOrgName] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  // Fetch organisations and active organisation from Better Auth
  const { data: organisations, isPending: isLoadingOrgs, refetch: refetchOrgs } = authClient.useListOrganizations();
  const { data: activeOrg, isPending: isLoadingActive } = authClient.useActiveOrganization();
  const [isAutoSetting, setIsAutoSetting] = React.useState(false);

  const isLoading = isLoadingOrgs || isLoadingActive || isAutoSetting;

  // Auto-set active organization if none is set but organizations exist
  React.useEffect(() => {
    async function autoSetActiveOrg() {
      // Only run if: not loading, no active org, organizations exist, and not already auto-setting
      if (isLoadingOrgs || isLoadingActive || isAutoSetting || activeOrg || !organisations || organisations.length === 0) {
        return;
      }

      setIsAutoSetting(true);
      try {
        await authClient.organization.setActive({ organizationId: organisations[0].id });
        // Reload to ensure all components get the updated session
        window.location.reload();
      } catch {
        // Silently fail - the UI will show "Create Organisation" if needed
        setIsAutoSetting(false);
      }
    }

    autoSetActiveOrg();
  }, [isLoadingOrgs, isLoadingActive, activeOrg, organisations, isAutoSetting]);

  // Handle organisation switch
  const handleSwitchOrganisation = async (org: { id: string; name: string }) => {
    try {
      await authClient.organization.setActive({ organizationId: org.id });
      notify.success(`Switched to ${org.name}`);
      // Small delay to show toast before reload
      setTimeout(() => window.location.reload(), 500);
    } catch {
      notify.error("Failed to switch organisation");
    }
  };

  // Handle create organisation
  const handleCreateOrganisation = async () => {
    if (!newOrgName.trim()) {
      notify.error("Please enter an organisation name");
      return;
    }

    setIsCreating(true);
    try {
      // Generate slug from name
      const slug = newOrgName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      const result = await authClient.organization.create({
        name: newOrgName.trim(),
        slug: `${slug}-${Date.now().toString(36)}`,
      });

      if (result.error) {
        notify.error(result.error.message || "Failed to create organisation");
        return;
      }

      setNewOrgName("");
      setIsCreateDialogOpen(false);
      refetchOrgs();

      // Switch to the new organisation and create starter journey
      if (result.data?.id) {
        await authClient.organization.setActive({ organizationId: result.data.id });

        // Create starter journey for the new organisation
        try {
          await apiClient.createJourney({
            name: STARTER_JOURNEY_METADATA.name,
            description: STARTER_JOURNEY_METADATA.description,
            configuration: STARTER_JOURNEY_CONFIG,
          });
        } catch (journeyError) {
          // Log but don't block - the org is created, journey creation is optional
          log.error({ err: serializeError(journeyError) }, "organisation-switcher:starterJourneyFailed");
        }

        notify.success(`Organisation "${newOrgName}" created with starter journey`);
        // Small delay to show toast before reload
        setTimeout(() => window.location.reload(), 500);
      } else {
        notify.success(`Organisation "${newOrgName}" created`);
        setTimeout(() => window.location.reload(), 500);
      }
    } catch {
      notify.error("Failed to create organisation");
    } finally {
      setIsCreating(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="animate-pulse">
            <div className="bg-sidebar-primary/20 flex aspect-square size-8 items-center justify-center rounded-lg">
              <Loader2 className="size-4 animate-spin" />
            </div>
            <div className="grid flex-1 text-left text-xs leading-tight">
              <span className="text-muted-foreground">Loading...</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // No organisations state
  if (!organisations || organisations.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" onClick={() => setIsCreateDialogOpen(true)} className="ring-sidebar-primary/50 focus-visible:ring-1">
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Plus className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-xs leading-tight">
              <span className="truncate font-semibold">Create Organisation</span>
              <span className="text-muted-foreground truncate text-xs">Get started</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <CreateOrganisationDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          name={newOrgName}
          onNameChange={setNewOrgName}
          onSubmit={handleCreateOrganisation}
          isCreating={isCreating}
        />
      </SidebarMenu>
    );
  }

  const currentOrg = activeOrg || organisations[0];

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="ring-sidebar-primary/50 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground focus-visible:ring-1"
              >
                {currentOrg.logo ? (
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage src={currentOrg.logo} alt={currentOrg.name} />
                    <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <Building2 className="size-4 shrink-0" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <Building2 className="size-4 shrink-0" />
                  </div>
                )}
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate font-semibold">{currentOrg.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {organisations.length} organisation{organisations.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 shrink-0" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">Organisations</DropdownMenuLabel>
              {organisations.map((org) => (
                <DropdownMenuItem key={org.id} onClick={() => handleSwitchOrganisation(org)} className="gap-2 p-2">
                  {org.logo ? (
                    <Avatar className="size-6 rounded-sm">
                      <AvatarImage src={org.logo} alt={org.name} />
                      <AvatarFallback className="rounded-sm">
                        <Building2 className="size-4 shrink-0" />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="flex size-6 items-center justify-center rounded-sm border">
                      <Building2 className="size-4 shrink-0" />
                    </div>
                  )}
                  <span className="flex-1 truncate">{org.name}</span>
                  {currentOrg.id === org.id && <Check className="size-4 shrink-0" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 p-2" onClick={() => setIsCreateDialogOpen(true)}>
                <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                  <Plus className="size-4 shrink-0" />
                </div>
                <span className="text-muted-foreground font-medium">Create organisation</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateOrganisationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        name={newOrgName}
        onNameChange={setNewOrgName}
        onSubmit={handleCreateOrganisation}
        isCreating={isCreating}
      />
    </>
  );
}

// =============================================================================
// CREATE ORGANISATION DIALOG
// =============================================================================

interface CreateOrganisationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  isCreating: boolean;
}

function CreateOrganisationDialog({ open, onOpenChange, name, onNameChange, onSubmit, isCreating }: CreateOrganisationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Organisation</DialogTitle>
          <DialogDescription>Create a new organisation to manage your journeys and team members.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="org-name">Organisation name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Acme Inc."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isCreating) {
                  onSubmit();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isCreating || !name.trim()}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

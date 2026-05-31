/**
 * Organisation Section
 *
 * Displays organisation settings and member management.
 *
 * @module components/settings/sections/organisation-section
 */

import { createLogger, serializeError } from "@journey/logger";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Building2, Loader2, Mail, Trash2, User, UserPlus } from "lucide-react";
import * as React from "react";

import { AvatarUpload } from "@/shared/components/ui/avatar-upload";
import { RoleBadge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Separator } from "@/shared/components/ui/separator";
import { authClient } from "@/shared/lib/auth-client";

import { notify } from "@/shared/lib/ui/notify";

const log = createLogger("organisation-section");

// =============================================================================
// TYPES
// =============================================================================

interface Member {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

type MemberRole = "owner" | "admin" | "member";

function isMemberRole(role: string): role is MemberRole {
  return role === "owner" || role === "admin" || role === "member";
}

// =============================================================================
// COMPONENT
// =============================================================================

export function OrganisationSection() {
  const navigate = useNavigate();
  const { data: activeOrg, isPending: isLoadingOrg } = authClient.useActiveOrganization();
  const { data: organisations, isPending: isLoadingOrgs } = authClient.useListOrganizations();
  const { data: session } = authClient.useSession();
  const [members, setMembers] = React.useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = React.useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("member");
  const [isInviting, setIsInviting] = React.useState(false);

  // Delete organisation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Logo state
  const [isSavingLogo, setIsSavingLogo] = React.useState(false);

  // Use active org, or fall back to the first organization in the list
  const currentOrg = activeOrg || (organisations && organisations.length > 0 ? organisations[0] : null);
  const isLoading = isLoadingOrg || isLoadingOrgs;

  // Fetch members when organisation changes
  React.useEffect(() => {
    async function fetchMembers() {
      if (!currentOrg?.id) return;

      setIsLoadingMembers(true);
      try {
        const result = await authClient.organization.listMembers({
          query: { organizationId: currentOrg.id },
        });

        if (result.data?.members) {
          setMembers(result.data.members as Member[]);
        }
      } catch (error) {
        log.error({ err: serializeError(error) }, "organisation:fetchMembers:error");
      } finally {
        setIsLoadingMembers(false);
      }
    }

    fetchMembers();
  }, [currentOrg?.id]);

  // Handle invite member
  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !currentOrg?.id) {
      notify.error("Please enter an email address");
      return;
    }

    setIsInviting(true);
    try {
      const result = await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole as "admin" | "member",
        organizationId: currentOrg.id,
      });

      if (result.error) {
        notify.error(result.error.message || "Failed to send invitation");
        return;
      }

      notify.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("member");
      setIsInviteDialogOpen(false);
    } catch {
      notify.error("Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  // Handle remove member
  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!currentOrg?.id) return;

    try {
      const result = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: currentOrg.id,
      });

      if (result.error) {
        notify.error(result.error.message || "Failed to remove member");
        return;
      }

      notify.success(`${memberEmail} has been removed from the organisation`);
      setMembers(members.filter((m) => m.id !== memberId));
    } catch {
      notify.error("Failed to remove member");
    }
  };

  // Handle delete organisation
  const handleDeleteOrganisation = async () => {
    if (!currentOrg?.id || deleteConfirmName !== currentOrg.name) {
      notify.error("Please type the organisation name correctly to confirm deletion");
      return;
    }

    setIsDeleting(true);
    try {
      const result = await authClient.organization.delete({
        organizationId: currentOrg.id,
      });

      if (result.error) {
        notify.error(result.error.message || "Failed to delete organisation");
        return;
      }

      notify.success(`Organisation "${currentOrg.name}" has been deleted`);
      setIsDeleteDialogOpen(false);
      setDeleteConfirmName("");

      // Switch to another organisation or redirect to dashboard
      const remainingOrgs = organisations?.filter((org) => org.id !== currentOrg.id) || [];
      if (remainingOrgs.length > 0) {
        // Switch to the first remaining organisation
        await authClient.organization.setActive({ organizationId: remainingOrgs[0].id });
        // Small delay to show toast before reload
        setTimeout(() => window.location.reload(), 500);
      } else {
        // No organisations left, redirect to dashboard (will show create org prompt)
        navigate({ to: "/" });
        setTimeout(() => window.location.reload(), 500);
      }
    } catch {
      notify.error("Failed to delete organisation");
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if this is the last organisation
  const isLastOrganisation = organisations?.length === 1;

  // Handle logo change
  const handleLogoChange = async (url: string | null) => {
    if (!currentOrg?.id) return;

    setIsSavingLogo(true);
    try {
      const result = await authClient.organization.update({
        data: { logo: url || undefined },
        organizationId: currentOrg.id,
      });

      if (result.error) {
        notify.error(result.error.message || "Failed to update logo");
        return;
      }

      notify.success(url ? "Logo updated successfully" : "Logo removed");
      // Reload to update the sidebar and other places showing the logo
      setTimeout(() => window.location.reload(), 500);
    } catch {
      notify.error("Failed to update logo");
    } finally {
      setIsSavingLogo(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No organisation state
  if (!currentOrg) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center">
        <Building2 className="mx-auto size-8 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No Organisation Selected</h3>
        <p className="mt-2 text-sm text-muted-foreground">Please select or create an organisation to manage settings.</p>
      </div>
    );
  }

  const currentUserMember = members.find((m) => m.userId === session?.user?.id);
  const isOwner = currentUserMember?.role === "owner";
  const isAdmin = currentUserMember?.role === "admin" || isOwner;

  return (
    <div className="space-y-6">
      {/* Organisation Info */}
      <div>
        <h2 className="text-lg font-semibold">Organisation Details</h2>
        <p className="text-sm text-muted-foreground">Information about your current organisation</p>
      </div>

      {/* Logo */}
      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6 p-4 rounded-lg border bg-muted/30">
        <AvatarUpload
          value={currentOrg.logo}
          onChange={handleLogoChange}
          size={80}
          disabled={isSavingLogo || !isAdmin}
          fallback={<Building2 className="size-1/3 text-muted-foreground" />}
        />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-medium">{currentOrg.name}</h3>
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {isAdmin ? "Upload a logo for your organisation. JPEG, PNG, GIF or WebP. Max 5MB." : "Only admins can change the organisation logo."}
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            Organisation Name
          </Label>
          <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">{currentOrg.name}</div>
        </div>

        {/* Slug - dont use now but keep it here for future */}
        {/* {currentOrg.slug && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">Slug</Label>
            <div className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">{currentOrg.slug}</div>
          </div>
        )} */}
      </div>

      <Separator />

      {/* Members Section */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Members</h2>
            <p className="text-sm text-muted-foreground">People who have access to this organisation</p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setIsInviteDialogOpen(true)}>
              <UserPlus className="mr-2 size-4" />
              Invite
            </Button>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {isLoadingMembers ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No members found</div>
          ) : (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                    <User className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{member.user.name}</span>
                      <RoleBadge role={isMemberRole(member.role) ? member.role : "member"} size="md" />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="size-3" />
                      {member.user.email}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {isAdmin && member.role !== "owner" && member.userId !== session?.user?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemoveMember(member.id, member.user.email)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>Send an invitation to join your organisation.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Admins can manage members and settings. Members can view and edit journeys.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)} disabled={isInviting}>
              Cancel
            </Button>
            <Button onClick={handleInviteMember} disabled={isInviting || !inviteEmail.trim()}>
              {isInviting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Danger Zone */}
      {isOwner && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground">Irreversible actions for this organisation</p>
          </div>

          <div className="rounded-md border border-destructive/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Delete Organisation</h3>
                <p className="text-xs text-muted-foreground">Permanently delete this organisation and all its data</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)} disabled={isLastOrganisation}>
                Delete
              </Button>
            </div>
            {isLastOrganisation && <p className="mt-2 text-xs text-muted-foreground">You cannot delete your last organisation. Create a new one first.</p>}
          </div>
        </>
      )}

      {/* Delete Organisation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Delete Organisation
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the organisation <strong>{currentOrg.name}</strong> and all associated data including
              journeys, bots, and member access.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="delete-confirm">
                Type <strong>{currentOrg.name}</strong> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={currentOrg.name}
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeleteConfirmName("");
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteOrganisation} disabled={isDeleting || deleteConfirmName !== currentOrg.name}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Organisation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Profile Section
 *
 * Displays and allows editing of user profile information.
 * Includes avatar upload, name editing and password change functionality.
 *
 * @module components/settings/sections/profile-section
 */

import { Check, Eye, EyeOff, Key, Loader2, Mail, Pencil, User, X } from "lucide-react";
import * as React from "react";

import { AvatarUpload } from "@/shared/components/ui/avatar-upload";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import { authClient } from "@/shared/lib/auth-client";

import { notify } from "@/shared/lib/ui/notify";

// =============================================================================
// COMPONENT
// =============================================================================

export function ProfileSection() {
  const { data: session, isPending: isLoadingSession } = authClient.useSession();

  // Name editing state
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [editedName, setEditedName] = React.useState("");
  const [isSavingName, setIsSavingName] = React.useState(false);

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [isSavingPassword, setIsSavingPassword] = React.useState(false);

  // Avatar state
  const [isSavingAvatar, setIsSavingAvatar] = React.useState(false);

  // Initialize edited name when session loads
  React.useEffect(() => {
    if (session?.user?.name) {
      setEditedName(session.user.name);
    }
  }, [session?.user?.name]);

  // Handle save name
  const handleSaveName = async () => {
    if (!editedName.trim()) {
      notify.error("Name cannot be empty");
      return;
    }

    if (editedName.trim() === session?.user?.name) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    try {
      const result = await authClient.updateUser({
        name: editedName.trim(),
      });

      if (result.error) {
        notify.error(result.error.message || "Failed to update name");
        return;
      }

      notify.success("Name updated successfully");
      setIsEditingName(false);
    } catch {
      notify.error("Failed to update name");
    } finally {
      setIsSavingName(false);
    }
  };

  // Handle cancel name edit
  const handleCancelNameEdit = () => {
    setEditedName(session?.user?.name || "");
    setIsEditingName(false);
  };

  // Handle change password
  const handleChangePassword = async () => {
    if (!currentPassword) {
      notify.error("Please enter your current password");
      return;
    }

    if (!newPassword) {
      notify.error("Please enter a new password");
      return;
    }

    if (newPassword.length < 8) {
      notify.error("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      notify.error("Passwords do not match");
      return;
    }

    setIsSavingPassword(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (result.error) {
        notify.error(result.error.message || "Failed to change password");
        return;
      }

      notify.success("Password changed successfully. Other sessions have been logged out.");
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      notify.error("Failed to change password");
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Handle cancel password change
  const handleCancelPasswordChange = () => {
    setIsChangingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  };

  // Handle avatar change
  const handleAvatarChange = async (url: string | null) => {
    setIsSavingAvatar(true);
    try {
      const result = await authClient.updateUser({
        image: url || undefined,
      });

      if (result.error) {
        notify.error(result.error.message || "Failed to update avatar");
        return;
      }

      notify.success(url ? "Avatar updated successfully" : "Avatar removed");
    } catch {
      notify.error("Failed to update avatar");
    } finally {
      setIsSavingAvatar(false);
    }
  };

  // Loading state
  if (isLoadingSession) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">Your account information</p>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6 p-4 rounded-lg border bg-muted/30">
        <AvatarUpload
          value={session?.user?.image}
          onChange={handleAvatarChange}
          size={96}
          disabled={isSavingAvatar}
          fallback={
            session?.user?.name ? <span className="text-2xl font-medium text-muted-foreground">{session.user.name.charAt(0).toUpperCase()}</span> : undefined
          }
        />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-medium">{session?.user?.name || "User"}</h3>
          <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
          <p className="text-xs text-muted-foreground mt-2">Upload a profile picture. JPEG, PNG, GIF or WebP. Max 5MB.</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            Name
          </Label>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Your name"
                className="flex-1"
                disabled={isSavingName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") handleCancelNameEdit();
                }}
                autoFocus
              />
              <Button size="icon" variant="ghost" onClick={handleSaveName} disabled={isSavingName || !editedName.trim()}>
                {isSavingName ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 text-green-600" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={handleCancelNameEdit} disabled={isSavingName}>
                <X className="size-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">{session?.user?.name || "Not set"}</div>
              <Button size="icon" variant="ghost" onClick={() => setIsEditingName(true)}>
                <Pencil className="size-4 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            Email
          </Label>
          <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">{session?.user?.email || "Not set"}</div>
          <p className="text-xs text-muted-foreground">Email changes are not available in the current version.</p>
        </div>
      </div>

      <Separator />

      {/* Password Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Security</h2>
            <p className="text-sm text-muted-foreground">Manage your account security</p>
          </div>
        </div>

        {isChangingPassword ? (
          <div className="space-y-4 rounded-md border p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Key className="size-4" />
              Change Password
            </h3>

            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  disabled={isSavingPassword}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 8 characters)"
                  disabled={isSavingPassword}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={isSavingPassword}
              />
              {confirmPassword && newPassword !== confirmPassword && <p className="text-xs text-destructive">Passwords do not match</p>}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelPasswordChange} disabled={isSavingPassword}>
                <X className="mr-2 size-4" />
                Cancel
              </Button>
              <Button
                onClick={handleChangePassword}
                disabled={isSavingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
              >
                {isSavingPassword ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Key className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-medium">Password</h3>
                  <p className="text-xs text-muted-foreground">Change your account password</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsChangingPassword(true)}>
                Change Password
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

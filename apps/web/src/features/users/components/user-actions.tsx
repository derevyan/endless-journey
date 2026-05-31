/**
 * User Actions
 *
 * Action buttons for user profile: impersonate button.
 *
 * @module components/users/user-actions
 */

import { Play } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

interface UserActionsProps {
  onImpersonate: () => void;
}

export function UserActions({ onImpersonate }: UserActionsProps) {
  return (
    <div className="flex justify-end">
      <Button onClick={onImpersonate} variant="outline" size="sm" className="gap-2">
        <Play className="size-4" />
        Impersonate
      </Button>
    </div>
  );
}

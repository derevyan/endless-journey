/**
 * useSignOut - Sign out and redirect to the app root.
 *
 * @module shared/hooks/use-sign-out
 */

import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

import { authClient } from "@/shared/lib/auth-client";

export function useSignOut() {
  const navigate = useNavigate();

  return useCallback(async () => {
    await authClient.signOut();
    navigate({ to: "/", replace: true });
  }, [navigate]);
}

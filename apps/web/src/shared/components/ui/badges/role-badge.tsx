import type { ReactNode } from "react";

import { Crown, Shield, User } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { Badge, type BadgeProps } from "./badge";

type Role = "owner" | "admin" | "member";

interface RoleBadgeProps {
  role: Role;
  size?: BadgeProps["size"];
  showIcon?: boolean;
  className?: string;
}

const roleConfig: Record<Role, { variant: BadgeProps["variant"]; icon: ReactNode }> = {
  owner: { variant: "default", icon: <Crown className="h-3 w-3" /> },
  admin: { variant: "secondary", icon: <Shield className="h-3 w-3" /> },
  member: { variant: "outline", icon: <User className="h-3 w-3" /> },
};

function formatRoleLabel(role: Role): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function RoleBadge({ role, size = "default", showIcon = true, className }: RoleBadgeProps) {
  const config = roleConfig[role];

  return (
    <Badge variant={config.variant} size={size} className={cn("gap-1", className)}>
      {showIcon && config.icon}
      {formatRoleLabel(role)}
    </Badge>
  );
}

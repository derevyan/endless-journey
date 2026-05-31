/**
 * Users Table Columns
 *
 * Column definitions for the telegram users table.
 *
 * @module components/users/users-columns
 */

import type { ColumnDef } from "@tanstack/react-table";
import { User } from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { TagBadge } from "@/shared/components/ui/badges";
import type { TelegramUser } from "@/shared/lib/api";
import { formatRelativeTime } from "@/shared/lib/utils/date-utils";

import { DataTableColumnHeader } from "@/shared/components/ui/data-table";

interface UsersColumnsProps {
  tagDefinitions?: Map<string, { color?: string | null; description?: string | null }>;
  /** Enable checkbox row selection column. Defaults to false. */
  enableRowSelection?: boolean;
}

export function getUsersColumns({ tagDefinitions, enableRowSelection = false }: UsersColumnsProps): ColumnDef<TelegramUser>[] {
  const columns: ColumnDef<TelegramUser>[] = [];

  // Only add select column if selection is enabled
  if (enableRowSelection) {
    columns.push({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" />,
      enableSorting: false,
      enableHiding: false,
    });
  }

  columns.push({
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const user = row.original;
        const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unknown";
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium">{displayName}</div>
              {user.username && <div className="text-xs text-muted-foreground">@{user.username}</div>}
            </div>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        const user = row.original;
        const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").toLowerCase();
        const username = user.username?.toLowerCase() ?? "";
        const searchValue = (value as string).toLowerCase();
        return displayName.includes(searchValue) || username.includes(searchValue);
      },
    },
    {
      accessorKey: "tags",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tags" />,
      cell: ({ row }) => {
        const tags = row.original.tags || [];
        if (tags.length === 0) {
          return <span className="text-muted-foreground text-xs">No tags</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {tags.slice(0, 3).map((tag, i) => {
              const tagDef = tagDefinitions?.get(tag);
              return <TagBadge key={i} tag={tag} color={tagDef?.color} className="text-xs" />;
            })}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        );
      },
      filterFn: (row, id, value) => {
        const tags = row.original.tags || [];
        return (value as string[]).some((v) => tags.includes(v));
      },
      enableSorting: false,
    },
    {
      accessorKey: "platform",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Platform" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.platform}
        </Badge>
      ),
      filterFn: (row, id, value) => {
        return (value as string[]).includes(row.getValue(id));
      },
      enableSorting: false,
    },
    {
      accessorKey: "sessionCount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sessions" />,
      cell: ({ row }) => <div>{row.original.sessionCount}</div>,
    },
    {
      accessorKey: "lastActiveAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Active" />,
      cell: ({ row }) => {
        const lastActive = row.original.lastActiveAt;
        return <div className="text-muted-foreground">{lastActive ? formatRelativeTime(lastActive) : "Never"}</div>;
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
      cell: ({ row }) => {
        const createdAt = row.original.createdAt;
        return <div className="text-muted-foreground">{createdAt ? formatRelativeTime(createdAt) : "Unknown"}</div>;
      },
    },
  );

  return columns;
}

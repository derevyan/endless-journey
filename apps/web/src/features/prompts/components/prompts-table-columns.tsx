/**
 * Prompts Table Columns
 *
 * Column definitions for the prompts table.
 * Follows pattern from: features/users/components/users-columns.tsx
 *
 * @module features/prompts/components/prompts-table-columns
 */

import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Trash2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { formatRelativeTime } from "@/shared/lib/utils/date-utils";
import type { PromptResponse } from "@journey/schemas";

import { DataTableColumnHeader } from "@/shared/components/ui/data-table";
import { PromptTypeBadge } from "./prompt-type-badge";

// =============================================================================
// TYPES
// =============================================================================

interface PromptsColumnsOptions {
  onDelete?: (name: string) => void;
}

// =============================================================================
// COLUMNS
// =============================================================================

export function getPromptsColumns({ onDelete }: PromptsColumnsOptions = {}): ColumnDef<PromptResponse>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const prompt = row.original;
        return (
          <div className="flex items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{prompt.name}</div>
              {prompt.description && (
                <div className="text-xs text-muted-foreground truncate">
                  {prompt.description}
                </div>
              )}
            </div>
          </div>
        );
      },
      filterFn: (row, _id, value) => {
        const prompt = row.original;
        const searchValue = (value as string).toLowerCase();
        return (
          prompt.name.toLowerCase().includes(searchValue) ||
          (prompt.description?.toLowerCase().includes(searchValue) ?? false)
        );
      },
    },
    {
      id: "versions",
      header: "Version",
      cell: ({ row }) => {
        const latestVersion = row.original.latestVersion;
        const hasProduction = !!row.original.productionVersion;

        if (!latestVersion) {
          return <span className="text-muted-foreground text-xs">-</span>;
        }

        return (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {latestVersion.versionId}
            </span>
            {hasProduction && (
              <span className="size-2 rounded-full bg-emerald-500" title="Has production version" />
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => <PromptTypeBadge type={row.original.type} />,
      filterFn: (row, _id, value) => {
        return (value as string[]).includes(row.original.type);
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => {
        const createdAt = row.original.createdAt;
        return (
          <div className="text-muted-foreground text-sm">
            {createdAt ? formatRelativeTime(createdAt) : "Unknown"}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const prompt = row.original;
        return (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(prompt.name);
            }}
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Delete</span>
          </Button>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}

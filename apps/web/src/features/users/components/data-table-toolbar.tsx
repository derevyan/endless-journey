/**
 * Data Table Toolbar
 *
 * Toolbar with search input, faceted filters, and view options.
 *
 * @module components/users/data-table-toolbar
 */

import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

import { DataTableFacetedFilter, DataTableViewOptions } from "@/shared/components/ui/data-table";

// Platform options for filtering
const platformOptions = [
  { label: "Telegram", value: "telegram" },
  { label: "WhatsApp", value: "whatsapp" },
];

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  tagOptions?: { label: string; value: string }[];
}

export function DataTableToolbar<TData>({ table, tagOptions = [] }: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
        <Input
          placeholder="Filter by name..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />
        <div className="flex gap-x-2">
          {table.getColumn("tags") && tagOptions.length > 0 && <DataTableFacetedFilter column={table.getColumn("tags")} title="Tags" options={tagOptions} />}
          {table.getColumn("platform") && <DataTableFacetedFilter column={table.getColumn("platform")} title="Platform" options={platformOptions} />}
        </div>
        {isFiltered && (
          <Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-8 px-2 lg:px-3">
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}

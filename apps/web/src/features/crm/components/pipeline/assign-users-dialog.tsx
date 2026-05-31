/**
 * Assign Users Dialog
 *
 * Modal to select and assign unassigned clients to a pipeline stage.
 *
 * @module components/crm/pipeline/assign-users-dialog
 */

import { useState, useMemo } from "react";
import { Search, Loader2, UserPlus } from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import type { CrmClient } from "@/shared/lib/api";
import { getDisplayName } from "@/shared/lib/utils/user-utils";

interface AssignUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName: string;
  stageColor: string;
  unassignedClients: CrmClient[];
  onAssign: (clientIds: string[]) => void;
  isAssigning?: boolean;
}

export function AssignUsersDialog({
  open,
  onOpenChange,
  stageName,
  stageColor,
  unassignedClients,
  onAssign,
  isAssigning = false,
}: AssignUsersDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!search.trim()) return unassignedClients;
    const query = search.toLowerCase();
    return unassignedClients.filter((client) => {
      const name = `${client.firstName || ""} ${client.lastName || ""}`.toLowerCase();
      const username = (client.username || "").toLowerCase();
      return name.includes(query) || username.includes(query);
    });
  }, [unassignedClients, search]);

  const handleToggle = (clientId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredClients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClients.map((c) => c.id)));
    }
  };

  const handleAssign = () => {
    if (selectedIds.size === 0) return;
    onAssign(Array.from(selectedIds));
  };

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSearch("");
      setSelectedIds(new Set());
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: stageColor }}
            />
            Assign to {stageName}
          </DialogTitle>
          <DialogDescription>
            Select clients to move them to this stage
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Client list */}
        <ScrollArea className="h-64">
          {filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <UserPlus className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {unassignedClients.length === 0
                  ? "No unassigned clients"
                  : "No clients match your search"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Select all */}
              <div
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
                onClick={handleSelectAll}
              >
                <Checkbox
                  checked={selectedIds.size === filteredClients.length && filteredClients.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  Select all ({filteredClients.length})
                </span>
              </div>

              <div className="border-t my-2" />

              {/* Client list */}
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
                  onClick={() => handleToggle(client.id)}
                >
                  <Checkbox
                    checked={selectedIds.has(client.id)}
                    onCheckedChange={() => handleToggle(client.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getDisplayName(client)}
                    </p>
                    {client.username && (
                      <p className="text-xs text-muted-foreground">
                        @{client.username}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {client.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {client.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{client.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedIds.size === 0 || isAssigning}
          >
            {isAssigning && <Loader2 className="mr-2 size-4 animate-spin" />}
            Assign {selectedIds.size > 0 && `(${selectedIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

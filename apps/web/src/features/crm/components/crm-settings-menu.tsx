/**
 * CRM Settings Menu
 *
 * Button that opens the CRM Settings dialog.
 *
 * @module components/crm/crm-settings-menu
 */

import { Settings } from "lucide-react";
import { useState } from "react";

import { CrmSettingsDialog } from "@/features/crm/components/crm-settings-dialog";
import { Button } from "@/shared/components/ui/button";
import type { Pipeline } from "@/shared/lib/api";

interface CrmSettingsMenuProps {
  pipeline?: Pipeline;
  onPipelineDeleted?: () => void;
}

export function CrmSettingsMenu({ pipeline, onPipelineDeleted }: CrmSettingsMenuProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
        <Settings className="size-4" />
      </Button>
      <CrmSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} pipeline={pipeline} onPipelineDeleted={onPipelineDeleted} />
    </>
  );
}

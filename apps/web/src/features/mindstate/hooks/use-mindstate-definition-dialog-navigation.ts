import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";

import { notify } from "@/shared/lib/ui/notify";
import { uiActions, uiStore } from "@/stores/ui-store";

export function useMindstateDefinitionDialogNavigation() {
  const navigate = useNavigate();
  const { newDefinitionName, newDefinitionKey, newDefinitionDescription, newDefinitionSelectedJourneyIds } = useStore(uiStore, (state) => ({
    newDefinitionName: state.newDefinitionName,
    newDefinitionKey: state.newDefinitionKey,
    newDefinitionDescription: state.newDefinitionDescription,
    newDefinitionSelectedJourneyIds: state.newDefinitionSelectedJourneyIds,
  }));

  const selectedJourneyIds = newDefinitionSelectedJourneyIds.join(",");

  const handleCreate = useCallback(() => {
    if (!newDefinitionName.trim() || !newDefinitionKey.trim()) {
      notify.error("Please fill in name and key fields");
      return;
    }

    if (!/^[a-z0-9-]+$/.test(newDefinitionKey)) {
      notify.error("Key must be lowercase alphanumeric with hyphens only");
      return;
    }

    // Close dialog and reset
    uiActions.resetNewDefinitionDialog();

    // Navigate to builder with params
    navigate({
      to: "/mindstate/$definitionKey",
      params: { definitionKey: "new" },
      search: {
        name: newDefinitionName,
        key: newDefinitionKey,
        description: newDefinitionDescription,
        journeyIds: selectedJourneyIds.length > 0 ? selectedJourneyIds : undefined,
      },
    });
  }, [newDefinitionName, newDefinitionKey, newDefinitionDescription, navigate, selectedJourneyIds]);

  return { handleCreate };
}

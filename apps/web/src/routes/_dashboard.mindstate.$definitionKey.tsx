/**
 * MindState Builder Route
 *
 * Main builder interface for editing mindstate definitions.
 * Uses definition key as URL parameter for branded URLs.
 *
 * @module routes/_dashboard.mindstate.$definitionKey
 */

import { useEffect } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { z } from "zod";

import { ErrorBoundary } from "@/shared/components/common/error-boundary";
import { LoadingSpinner } from "@/shared/components/common/loading-spinner";
import { UnsavedChangesDialog } from "@/shared/components/common/unsaved-changes-dialog";
import { useUnsavedChangesProtection } from "@/shared/hooks";
import {
  BuilderLayout,
  builderStore,
  builderActions,
  builderSelectors,
  useMindstateDefinition,
} from "@/features/mindstate";

const searchSchema = z.object({
  name: z.string().optional(),
  key: z.string().optional(),
  description: z.string().optional(),
  journeyIds: z.string().optional(), // Comma-separated journey IDs to connect after save
});

export const Route = createFileRoute("/_dashboard/mindstate/$definitionKey")({
  validateSearch: searchSchema,
  component: MindstateBuilderPage,
});

function MindstateBuilderPage() {
  const { definitionKey } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const isNew = definitionKey === "new";

  // Store state
  const definition = useStore(builderStore, builderSelectors.definition);
  const isLoading = useStore(builderStore, builderSelectors.isLoading);
  const isDirty = useStore(builderStore, builderSelectors.isDirty);

  // Navigation protection for unsaved changes
  const { status: blockerStatus, proceed, reset } = useUnsavedChangesProtection({
    isDirty,
    enableBeforeUnload: false,
  });

  // Fetch existing definition by key
  const { data: fetchedDefinition, isLoading: isFetching, error } = useMindstateDefinition(
    isNew ? undefined : definitionKey
  );

  // Initialize store with definition
  useEffect(() => {
    if (isNew && search.key && search.name) {
      // Create new definition in store
      builderActions.createNewDefinition(search.key, search.name, search.description);
    } else if (fetchedDefinition) {
      builderActions.setDefinition(fetchedDefinition);
    }
  }, [isNew, search, fetchedDefinition]);

  // Handle loading state
  useEffect(() => {
    builderActions.setLoading(isFetching);
  }, [isFetching]);

  // Handle error or 404 (null definition)
  if ((error || (fetchedDefinition === null && !isFetching)) && !isNew) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Definition Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The mindstate definition "{definitionKey}" does not exist.
          </p>
          <button
            onClick={() => navigate({ to: "/mindstate" })}
            className="text-primary hover:underline"
          >
            Back to Definitions
          </button>
        </div>
      </div>
    );
  }

  // Show loading while fetching or initializing
  if (isLoading || isFetching || (!definition && !isNew)) {
    return <LoadingSpinner message="Loading definition..." />;
  }

  // Show error if no definition loaded for new - redirect back to list
  if (!definition && isNew && (!search.key || !search.name)) {
    navigate({ to: "/mindstate" });
    return null;
  }

  return (
    <ErrorBoundary>
      <>
        <BuilderLayout journeyIdsToConnect={isNew ? search.journeyIds : undefined} />
        <UnsavedChangesDialog
          open={blockerStatus === "blocked"}
          onProceed={proceed}
          onCancel={reset}
          title="Unsaved Changes"
          description="You have unsaved changes to this definition. If you leave now, your changes will be lost."
        />
      </>
    </ErrorBoundary>
  );
}

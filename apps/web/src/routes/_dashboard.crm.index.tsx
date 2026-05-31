/**
 * CRM Pipeline Index Route
 *
 * The main CRM pipeline view with kanban board.
 *
 * @module routes/_dashboard.crm.index
 */

import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, RefreshCw, Search, Star, X } from "lucide-react";
import { z } from "zod";
import { useMemo, useState } from "react";

import { CrmSettingsMenu } from "@/features/crm/components/crm-settings-menu";
import { PipelineKanban } from "@/features/crm/components/pipeline";
import { ActiveFiltersBadges, CrmFilterToolbar, type CrmFilters } from "@/features/crm/components/pipeline/crm-filters";
import { PipelineFormDialog, type PipelineFormData } from "@/features/crm/components/pipeline/pipeline-form-dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import {
  useCreateCrmPipeline,
  useCreateCrmStage,
  useCrmClients,
  useCrmPipelines,
  useCrmStages,
  useDeleteCrmStage,
  useReorderCrmStages,
  useUpdateClientStage,
  useUpdateCrmStage,
  type ClientFilters,
  type CreateStageInput,
} from "@/features/crm/hooks/queries";
import { useTags } from "@/hooks/queries/use-tags";
import { useDebounce } from "@/shared/hooks";
import { crmKeys } from "@/shared/lib/query-keys";
import { cn } from "@/shared/lib/utils";

// URL search params schema
const searchSchema = z.object({
  pipeline: z.string().optional(),
});

export const Route = createFileRoute("/_dashboard/crm/")({
  validateSearch: searchSchema,
  component: CrmPipelineIndex,
});

function CrmPipelineIndex() {
  // URL-based pipeline selection
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Pipeline state from URL (slug-based)
  const selectedPipelineSlug = search.pipeline;
  const [createPipelineOpen, setCreatePipelineOpen] = useState(false);

  // Filter state
  const [crmFilters, setCrmFilters] = useState<CrmFilters>({
    stageIds: [],
    tags: [],
    platforms: [],
    dateRange: undefined,
  });

  // Refresh state with minimum visible duration
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch pipelines first
  const { data: pipelines = [], isLoading: pipelinesLoading, refetch: refetchPipelines } = useCrmPipelines();

  // Auto-select default pipeline or first pipeline (must be before stages query)
  // Find pipeline by slug from URL, fall back to default or first
  const activePipeline = useMemo(() => {
    if (selectedPipelineSlug) {
      const found = pipelines.find((p) => p.slug === selectedPipelineSlug);
      if (found) return found;
    }
    const defaultPipeline = pipelines.find((p) => p.isDefault);
    return defaultPipeline || pipelines[0];
  }, [selectedPipelineSlug, pipelines]);

  // Use ID for internal API calls (stages, etc.)
  const activePipelineId = activePipeline?.id;

  // Build API filters - MUST be after activePipelineId is defined
  const apiFilters: ClientFilters = useMemo(() => {
    const f: ClientFilters = {};

    // Pipeline scope - request clients assigned to this pipeline only
    if (activePipelineId) {
      f.pipelineId = activePipelineId;
    }

    // Search
    if (debouncedSearch.trim()) {
      f.search = debouncedSearch.trim();
    }

    // Stage filter (supports multi-select)
    if (crmFilters.stageIds.length > 0) {
      f.stageIds = crmFilters.stageIds;
    }

    // Tags filter
    if (crmFilters.tags.length > 0) {
      f.tags = crmFilters.tags;
    }

    // Date range filter
    if (crmFilters.dateRange?.from) {
      f.dateFrom = crmFilters.dateRange.from.toISOString();
    }
    if (crmFilters.dateRange?.to) {
      f.dateTo = crmFilters.dateRange.to.toISOString();
    }

    return f;
  }, [activePipelineId, debouncedSearch, crmFilters]);

  // Fetch stages using activePipelineId (ensures correct pipeline)
  const { data: stages = [], isLoading: stagesLoading, refetch: refetchStages } = useCrmStages(activePipelineId);
  const { data: clientsData, isLoading: clientsLoading, isFetching: clientsFetching, refetch: refetchClients } = useCrmClients(apiFilters, 100, 0);
  const { data: allTags = [] } = useTags();

  // Create tag color lookup map
  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tag of allTags) {
      if (tag.color) {
        map[tag.tag] = tag.color;
      }
    }
    return map;
  }, [allTags]);

  // Stage mutations
  const updateStageMutation = useUpdateClientStage();
  const reorderStagesMutation = useReorderCrmStages();
  const createStageMutation = useCreateCrmStage();
  const updateCrmStageMutation = useUpdateCrmStage();
  const deleteCrmStageMutation = useDeleteCrmStage();

  // Pipeline mutations
  const createPipelineMutation = useCreateCrmPipeline();

  // Get all clients from API
  const allClients = useMemo(() => clientsData?.clients ?? [], [clientsData?.clients]);

  // Apply client-side platform filter
  const clients = useMemo(() => {
    if (crmFilters.platforms.length === 0) {
      return allClients;
    }
    return allClients.filter((client) => crmFilters.platforms.includes(client.platform));
  }, [allClients, crmFilters.platforms]);

  // Extract available tags and platforms from all data
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const client of allClients) {
      for (const tag of client.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [allClients]);

  const availablePlatforms = useMemo(() => {
    const platformSet = new Set<string>();
    for (const client of allClients) {
      platformSet.add(client.platform);
    }
    return Array.from(platformSet).sort();
  }, [allClients]);

  const isLoading = pipelinesLoading || stagesLoading || clientsLoading;

  // Pipeline handlers
  const handleCreatePipeline = (data: PipelineFormData) => {
    createPipelineMutation.mutate(
      { name: data.name, description: data.description, color: data.color },
      {
        onSuccess: async (newPipeline) => {
          // Refetch pipelines BEFORE navigation to prevent race condition
          // Ensures activePipeline useMemo can find the new pipeline by slug
          await queryClient.refetchQueries({ queryKey: crmKeys.pipelines() });

          // Navigate to the new pipeline via URL using slug
          navigate({
            to: "/crm",
            search: { pipeline: newPipeline.slug },
            replace: true,
          });
          setCreatePipelineOpen(false);
        },
      }
    );
  };

  const handlePipelineDeleted = () => {
    // Clear selection when pipeline is deleted (remove from URL)
    navigate({
      to: "/crm",
      search: { pipeline: undefined },
      replace: true,
    });
  };

  // Stage handlers
  const handleClientStageChange = (clientId: string, stageId: string | null) => {
    updateStageMutation.mutate({ clientId, stageId });
  };

  const handleStageReorder = (stageIds: string[]) => {
    if (!activePipelineId) return;
    reorderStagesMutation.mutate({ pipelineId: activePipelineId, stageIds });
  };

  const handleCreateStage = (data: { name: string; description?: string; color: string }) => {
    if (!activePipelineId) return;

    const input: CreateStageInput = {
      pipelineId: activePipelineId,
      name: data.name,
      description: data.description,
      color: data.color,
    };
    createStageMutation.mutate(input);
  };

  const handleUpdateStage = (stageId: string, data: { name: string; description?: string; color: string }) => {
    updateCrmStageMutation.mutate({ stageId, input: data });
  };

  const handleDeleteStage = (stageId: string) => {
    deleteCrmStageMutation.mutate(stageId);
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await Promise.all([refetchPipelines(), refetchStages(), refetchClients()]);
    // Minimum 500ms visible duration for the spin animation
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Search clients..." className="pl-8 pr-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              {searchQuery && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1 size-6" onClick={() => setSearchQuery("")}>
                  <X className="size-3" />
                </Button>
              )}
            </div>

            {/* Active Filters - Inline */}
            <ActiveFiltersBadges filters={crmFilters} onFiltersChange={setCrmFilters} stages={stages} tagColorMap={tagColorMap} />
          </div>

          <div className="flex items-center gap-2">
            {/* Pipeline Selector */}
            {pipelines.length > 0 && (
              <Select
                value={activePipeline?.slug}
                onValueChange={(slug) => {
                  navigate({
                    to: "/crm",
                    search: { pipeline: slug },
                    replace: true,
                  });
                }}
              >
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.slug}>
                      <div className="flex items-center gap-2">
                        {pipeline.color && <div className="size-2 rounded-full" style={{ backgroundColor: pipeline.color }} />}
                        <span>{pipeline.name}</span>
                        {pipeline.isDefault && <Star className="size-3 text-yellow-500 fill-yellow-500" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* New Pipeline Button */}
            <Button variant="outline" size="sm" onClick={() => setCreatePipelineOpen(true)}>
              <Plus className="mr-2 size-4" />
              New Pipeline
            </Button>

            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
            </Button>

            <CrmSettingsMenu pipeline={activePipeline} onPipelineDeleted={handlePipelineDeleted} />
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-3">
          <CrmFilterToolbar
            filters={crmFilters}
            onFiltersChange={setCrmFilters}
            stages={stages}
            availableTags={availableTags}
            availablePlatforms={availablePlatforms}
            tagColorMap={tagColorMap}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <PipelineKanban
          stages={stages}
          clients={clients}
          isLoading={isLoading}
          isFetching={clientsFetching}
          onClientStageChange={handleClientStageChange}
          onStageReorder={handleStageReorder}
          onCreateStage={handleCreateStage}
          onUpdateStage={handleUpdateStage}
          onDeleteStage={handleDeleteStage}
          isCreatingStage={createStageMutation.isPending}
          isUpdatingStage={updateCrmStageMutation.isPending}
          isDeletingStage={deleteCrmStageMutation.isPending}
          tagColorMap={tagColorMap}
        />
      </div>

      {/* Create Pipeline Dialog */}
      <PipelineFormDialog
        open={createPipelineOpen}
        onOpenChange={setCreatePipelineOpen}
        mode="create"
        onSubmit={handleCreatePipeline}
        isLoading={createPipelineMutation.isPending}
      />
    </div>
  );
}

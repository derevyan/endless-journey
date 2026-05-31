/**
 * Mindstate Panel Component
 *
 * Main panel showing all mindstates for a client.
 * Matches the BuilderDashboard layout with tabs for State/Insights.
 */
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { BarChart3, Boxes, Lightbulb } from "lucide-react";
import { getAgentColorClasses } from "../../lib/colors";
import { useClientMindstates, useMindstateDefinitions } from "../../hooks";
import { DynamicIcon } from "../common/dynamic-icon";
import { StateCard } from "../common/state-card";
import type { AgentInsight, StateParameter } from "@journey/schemas";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";

interface MindstatePanelProps {
  clientId: string;
}

export function MindstatePanel({ clientId }: MindstatePanelProps) {
  const { data: mindstates, isLoading } = useClientMindstates(clientId);
  const { data: definitions } = useMindstateDefinitions();

  if (isLoading) {
    return <MindstatePanelSkeleton />;
  }

  if (!mindstates?.length) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-muted/20">
        <Boxes className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No mindstates tracked for this user</p>
        <p className="text-xs text-muted-foreground mt-1">Configure mindstate tracking in journey settings</p>
      </div>
    );
  }

  // Helper to get definition name by ID
  const getDefinitionName = (definitionId: string): string => {
    const definition = definitions?.find((d) => d.id === definitionId);
    return definition?.name || definitionId;
  };

  // Flatten all parameters and insights from all mindstates
  const allParameters: StateParameter[] = mindstates.flatMap((m) => m.stateParameters);
  const allInsights: AgentInsight[] = mindstates.flatMap((m) => m.agentInsights);

  // Sort parameters by last update time (most recent first)
  const sortedParameters = [...allParameters].sort((a, b) => {
    const aTime = a.history?.length > 0 ? a.history[a.history.length - 1]?.timestamp || 0 : 0;
    const bTime = b.history?.length > 0 ? b.history[b.history.length - 1]?.timestamp || 0 : 0;
    return bTime - aTime;
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header with definition names */}
      <div className="px-3 py-2 flex items-center gap-2">
        <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {mindstates.map((m) => getDefinitionName(m.definitionId)).join(", ")}
        </span>
        {mindstates[0]?.lastAnalyzedAt && (
          <span className="text-[10px] text-muted-foreground/70 ml-auto">
            {formatDistanceToNow(new Date(mindstates[0].lastAnalyzedAt), { addSuffix: true })}
          </span>
        )}
      </div>

      <Tabs defaultValue="state" className="flex min-h-0 flex-1 flex-col">
        <div className="px-3 py-1.5">
          <TabsList className="w-full h-7">
            <TabsTrigger value="state" className="flex-1 text-xs h-6">
              <BarChart3 className="mr-1.5 h-3 w-3" />
              State
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex-1 text-xs h-6">
              <Lightbulb className="mr-1.5 h-3 w-3" />
              Insights
              {allInsights.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">
                  {allInsights.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="state" className="flex-1 min-h-0 m-0 overflow-hidden">
          <ScrollArea className="h-full min-h-0">
            <div className="p-3">
              {sortedParameters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <BarChart3 className="h-6 w-6 mb-2 opacity-50" />
                  <p className="text-xs">No parameters tracked</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {sortedParameters.map((param) => {
                    const lastReasoning =
                      param.history?.length > 0 ? param.history[param.history.length - 1]?.reasoning : undefined;
                    return <StateCard key={param.id} parameter={param} lastReasoning={lastReasoning} variant="detailed" />;
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="insights" className="flex-1 min-h-0 m-0 overflow-hidden">
          <ScrollArea className="h-full min-h-0">
            <div className="p-3 space-y-2">
              {allInsights.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Lightbulb className="h-6 w-6 mb-2 opacity-50" />
                  <p className="text-xs">No insights yet</p>
                </div>
              ) : (
                allInsights.map((insight) => <InsightCard key={insight.id} insight={insight} />)
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Insight Card - displays agent insight with analysis and updates
 * Matches the BuilderDashboard insight display style
 */
function InsightCard({ insight }: { insight: AgentInsight }) {
  const theme = getAgentColorClasses(insight.agentColor || "indigo");

  return (
    <div className={cn("p-2.5 rounded-lg border bg-card space-y-2 flex flex-col", theme.border)}>
      <div className="flex items-center gap-2">
        <Avatar className={cn("h-5 w-5 border", theme.bg)}>
          <AvatarFallback className="bg-transparent text-white">
            <DynamicIcon name={insight.agentAvatar || "Bot"} size={10} />
          </AvatarFallback>
        </Avatar>
        <span className={cn("text-xs font-medium", theme.text)}>{insight.agentName}</span>
      </div>
      {insight.analysis.length > 0 && (
        <ul className="text-[10px] space-y-0.5 text-muted-foreground">
          {insight.analysis.map((item) => (
            <li key={`${insight.id}-${item}`} className="flex items-start gap-1">
              <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )}
      {insight.updatesMade.length > 0 && (
        <div className="flex flex-wrap gap-1 items-end justify-between">
          <div className="flex flex-wrap gap-1">
            {insight.updatesMade.map((update) => (
              <span key={`${insight.id}-${update.id}`} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {update.name}
              </span>
            ))}
          </div>
          <span className="text-[8px] text-muted-foreground">
            {new Date(insight.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}

function MindstatePanelSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header skeleton */}
      <div className="px-3 py-2 flex items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-16 ml-auto" />
      </div>
      {/* Tabs skeleton */}
      <div className="px-3 py-1.5">
        <Skeleton className="h-7 w-full rounded-md" />
      </div>
      {/* Content skeleton */}
      <div className="p-3 space-y-2 flex-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

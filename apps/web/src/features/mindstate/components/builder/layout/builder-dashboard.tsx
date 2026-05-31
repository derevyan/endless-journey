/**
 * MindState Builder Dashboard
 *
 * Right panel with state visualization and insights.
 */

import { useStore } from "@tanstack/react-store";
import { BarChart3, Lightbulb } from "lucide-react";

import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { builderSelectors, builderStore } from "../../../stores/builder-store";
import { InsightBadge } from "../../common/insight-badge";
import { StateGrid } from "../state/state-grid";

export function BuilderDashboard() {
  const parameters = useStore(builderStore, builderSelectors.previewParameters);
  const insights = useStore(builderStore, builderSelectors.previewInsights);
  const activeUpdates = useStore(builderStore, (s) => s.preview.activeUpdates);

  // Sort parameters by last update time (most recent first)
  const sortedParameters = [...parameters].sort((a, b) => {
    const aTime = a.history?.length > 0 ? a.history[a.history.length - 1]?.timestamp || 0 : 0;
    const bTime = b.history?.length > 0 ? b.history[b.history.length - 1]?.timestamp || 0 : 0;
    return bTime - aTime;
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs defaultValue="state" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-4 py-2">
          <TabsList className="w-full">
            <TabsTrigger value="state" className="flex-1">
              <BarChart3 className="mr-1.5 h-3 w-3" />
              State
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex-1">
              <Lightbulb className="mr-1.5 h-3 w-3" />
              Insights
              {insights.length > 0 && <span className="ml-1.5 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">{insights.length}</span>}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="state" className="flex-1 min-h-0 m-0 overflow-hidden">
          <ScrollArea className="h-full min-h-0">
            <div className="p-4">
              {sortedParameters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No parameters configured</p>
                  <p className="text-xs mt-1">Add parameters in the sidebar to track state</p>
                </div>
              ) : (
                <StateGrid parameters={sortedParameters} activeUpdates={activeUpdates} />
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="insights" className="flex-1 min-h-0 m-0 overflow-hidden">
          <ScrollArea className="h-full min-h-0">
            <div className="p-4 space-y-3">
              {insights.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Lightbulb className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No insights yet</p>
                  <p className="text-xs mt-1">Send messages in the preview to generate insights</p>
                </div>
              ) : (
                insights.map((insight) => (
                  <div key={insight.id} className="p-3 rounded-lg border bg-card space-y-2 flex flex-col">
                    <div className="flex items-center gap-2">
                      <InsightBadge insight={insight} />
                    </div>
                    {insight.analysis.length > 0 && (
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {insight.analysis.map((item) => (
                          <li key={`${insight.id}-${item}`} className="flex items-start gap-1">
                            <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                    {insight.updatesMade.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-end justify-between">
                        <div className="flex flex-wrap gap-1">
                          {insight.updatesMade.map((update) => (
                            <span key={`${insight.id}-${update.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {update.name}
                            </span>
                          ))}
                        </div>
                        <span className="text-[8px] text-muted-foreground">{new Date(insight.timestamp).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

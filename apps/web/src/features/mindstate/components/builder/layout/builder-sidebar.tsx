/**
 * MindState Builder Sidebar
 *
 * Left panel with:
 * - Main Agent configuration
 * - Sub-Agents list
 * - Parameters list with categories
 * - Overview button to open assignment matrix dialog
 */

import { useState } from "react";
import { useStore } from "@tanstack/react-store";
import { Bot, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, Grid3X3, Hash, Plus, Users } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Separator } from "@/shared/components/ui/separator";

import { builderActions, builderSelectors, builderStore } from "../../../stores/builder-store";
import { MainAgentCard } from "../agents/main-agent-card";
import { SystemAgentList } from "../agents/system-agent-list";
import { ParameterList } from "../parameters/parameter-list";
import { MatrixDialog } from "../matrix";

export function BuilderSidebar() {
  const [isAgentsOpen, setIsAgentsOpen] = useState(true);
  const [isParametersOpen, setIsParametersOpen] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);

  const mainAgent = useStore(builderStore, builderSelectors.mainAgent);
  const systemAgents = useStore(builderStore, builderSelectors.systemAgents);
  const parameters = useStore(builderStore, builderSelectors.parameters);
  const categories = useStore(builderStore, builderSelectors.categories);

  // Get category keys that have parameters
  const categoryKeys = [...new Set(parameters.map((p) => p.category))].sort();

  const expandAllCategories = () => setCollapsedCategories(new Set());
  const collapseAllCategories = () => setCollapsedCategories(new Set(categoryKeys));

  return (
    <>
      <ScrollArea className="h-full">
        <div className="py-3 px-3 space-y-3">
          {/* Main Agent Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Bot className="size-3.5" />
                Main Agent
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 h-6 w-6"
                onClick={() => setIsMatrixOpen(true)}
                title="Agent × Parameter Matrix"
              >
                <Grid3X3 className="size-3.5" />
              </Button>
            </div>
            {mainAgent && (
              <MainAgentCard
                agent={mainAgent}
                onClick={() => builderActions.openAgentModal(mainAgent.id, true)}
              />
            )}
          </section>

          <Separator />

          {/* System Agents Section */}
          <Collapsible open={isAgentsOpen} onOpenChange={setIsAgentsOpen} className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
                {isAgentsOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                <Users className="size-3.5" />
                Sub-Agents
                <span className="font-normal opacity-70 ml-1">({systemAgents.length})</span>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 h-6 w-6"
                onClick={() => builderActions.openAgentModal(null, false)}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
              <SystemAgentList
                agents={systemAgents}
                onAgentClick={(agent) => builderActions.openAgentModal(agent.id, false)}
              />
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Parameters Section */}
          <Collapsible open={isParametersOpen} onOpenChange={setIsParametersOpen} className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
                {isParametersOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                <Hash className="size-3.5" />
                Parameters
                <span className="font-normal opacity-70 ml-1">({parameters.length})</span>
              </CollapsibleTrigger>
              <div className="flex items-center gap-0.5">
                {parameters.length > 0 && (
                  <>
                    <button
                      onClick={expandAllCategories}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent/30 rounded"
                      title="Expand all"
                    >
                      <ChevronsDown className="size-3" />
                    </button>
                    <button
                      onClick={collapseAllCategories}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent/30 rounded"
                      title="Collapse all"
                    >
                      <ChevronsUp className="size-3" />
                    </button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 h-6 w-6"
                  onClick={() => builderActions.openParameterModal(null)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
              <ParameterList
                parameters={parameters}
                categories={categories}
                onParameterClick={(param) => builderActions.openParameterModal(param.id)}
                collapsedCategories={collapsedCategories}
                onToggleCategory={(category) => {
                  setCollapsedCategories((prev) => {
                    const next = new Set(prev);
                    if (next.has(category)) {
                      next.delete(category);
                    } else {
                      next.add(category);
                    }
                    return next;
                  });
                }}
              />
            </CollapsibleContent>
          </Collapsible>

        </div>
      </ScrollArea>

      {/* Matrix Dialog */}
      <MatrixDialog open={isMatrixOpen} onOpenChange={setIsMatrixOpen} />
    </>
  );
}

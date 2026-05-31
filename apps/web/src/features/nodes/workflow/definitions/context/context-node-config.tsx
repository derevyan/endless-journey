/**
 * Context Node Config
 *
 * Configuration panel for Context workflow nodes.
 * Uses TanStack Form for explicit save pattern.
 *
 * @module features/nodes/workflow/definitions/context/context-node-config
 */

import { useRef } from "react";
import { Plus, Trash2 } from "lucide-react";

import type { ContextSource } from "@journey/schemas";

import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { generateShortId } from "@/shared/lib/utils/id";

import {
  CONTEXT_SOURCE_TYPES,
  createDefaultContextSource,
} from "@/features/agent-workflows/constants/node-config-options";
import { useWorkflowFormFieldValue } from "@/features/nodes/workflow/hooks/use-workflow-node-form";

import type { WorkflowNodeEditorProps } from "../../registry/types";

export function ContextNodeConfig({ form }: WorkflowNodeEditorProps) {
  // Subscribe to sources array for reactivity
  const sources = useWorkflowFormFieldValue<ContextSource[]>(form, "sources") ?? [];
  const sourceIdsRef = useRef<string[]>([]);

  if (sourceIdsRef.current.length !== sources.length) {
    sourceIdsRef.current = sources.map(
      (_, index) => sourceIdsRef.current[index] ?? generateShortId("ctx")
    );
  }

  const sourceIds = sourceIdsRef.current;

  const addSource = () => {
    const newSource = createDefaultContextSource("memory");
    sourceIdsRef.current = [...sourceIdsRef.current, generateShortId("ctx")];
    form.setFieldValue("sources", [...sources, newSource]);
  };

  const updateSource = (index: number, newSource: ContextSource) => {
    const newSources = sources.map((source, i) => (i === index ? newSource : source));
    form.setFieldValue("sources", newSources);
  };

  const changeSourceType = (index: number, type: ContextSource["type"]) => {
    const newSource = createDefaultContextSource(type);
    updateSource(index, newSource);
  };

  const removeSource = (index: number) => {
    sourceIdsRef.current = sourceIdsRef.current.filter((_, i) => i !== index);
    form.setFieldValue("sources", sources.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Context Sources</Label>
        <Button variant="outline" size="sm" onClick={addSource}>
          <Plus className="h-4 w-4 mr-1" />
          Add Source
        </Button>
      </div>

      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
          No context sources configured. Add a source to inject context into the workflow.
        </p>
      ) : (
        <div className="space-y-3">
          {sources.map((source, index) => (
            <div key={sourceIds[index]} className="space-y-3 p-3 border rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Source {index + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeSource(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={source.type}
                  onValueChange={(value) => changeSourceType(index, value as ContextSource["type"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTEXT_SOURCE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {source.type === "memory" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Max Results</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={source.maxResults}
                      onChange={(e) =>
                        updateSource(index, { ...source, maxResults: parseInt(e.target.value) || 10 })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recency Bias (0-1)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={source.recencyBias}
                      onChange={(e) =>
                        updateSource(index, { ...source, recencyBias: parseFloat(e.target.value) || 0.3 })
                      }
                    />
                  </div>
                </>
              )}

              {source.type === "knowledge_base" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Knowledge Base ID</Label>
                    <Input
                      value={source.kbId}
                      onChange={(e) => updateSource(index, { ...source, kbId: e.target.value })}
                      placeholder="kb-123"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max Results</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={source.maxResults}
                      onChange={(e) =>
                        updateSource(index, { ...source, maxResults: parseInt(e.target.value) || 5 })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Similarity Threshold (0-1)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={source.similarity}
                      onChange={(e) =>
                        updateSource(index, { ...source, similarity: parseFloat(e.target.value) || 0.7 })
                      }
                    />
                  </div>
                </>
              )}

              {source.type === "rag" && (
                <>
                  <div className="space-y-1.5">
                    <Label>RAG Index ID</Label>
                    <Input
                      value={source.indexId}
                      onChange={(e) => updateSource(index, { ...source, indexId: e.target.value })}
                      placeholder="rag-index-123"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max Results</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={source.maxResults}
                      onChange={(e) =>
                        updateSource(index, { ...source, maxResults: parseInt(e.target.value) || 5 })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Similarity Threshold (0-1)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={source.similarity}
                      onChange={(e) =>
                        updateSource(index, { ...source, similarity: parseFloat(e.target.value) || 0.7 })
                      }
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

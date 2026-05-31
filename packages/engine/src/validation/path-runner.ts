import { createLogger } from "@journey/logger";
import { JourneyConfig } from "@journey/schemas";
import { SessionEngine } from "../session-engine";
import { MockMessagingAdapter } from "./mock-adapter";
import { PathExplorer } from "./path-explorer";
import { EnhancedUserJourney } from "@journey/schemas";

export interface PathRunnerResult {
    pathId: string;
    success: boolean;
    error?: string;
    stack?: string;
    visitedNodes: string[];
    steps: {
        nodeId: string;
        action: string;
        details?: string;
    }[];
}

export class PathRunner {
    private journey: JourneyConfig;
    private logger: ReturnType<typeof createLogger>;

    constructor(journey: JourneyConfig, logger?: ReturnType<typeof createLogger>) {
        this.journey = journey;
        this.logger = logger || createLogger("path-runner");
    }

    /**
     * Run all discovered paths and validate they complete successfully.
     */
    public async runAllPaths(): Promise<PathRunnerResult[]> {
        const explorer = new PathExplorer(this.journey);
        const paths = explorer.findPaths();
        const results: PathRunnerResult[] = [];

        this.logger.info({ pathCount: paths.length }, "pathRunner:start");

        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            const result = await this.runSinglePath(path, `path-${i}`);
            results.push(result);
        }

        return results;
    }

    /**
     * Execute a single path using the SessionEngine.
     */
    private async runSinglePath(path: string[], pathId: string): Promise<PathRunnerResult> {
        const adapter = new MockMessagingAdapter();
        
        // Mock session state
        const session: EnhancedUserJourney = {
            sessionId: `test-session-${pathId}`,
            journeyId: "test-journey",
            userId: "test-user",
            platformUserId: "test-user",
            currentNodeId: path[0], // Start node
            status: "active",
            context: {},
            tags: [],
            history: [],
            pendingTimers: [],
            pendingPluginFollowUps: [],
            nodeOutputs: {},
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null,
    hasStarted: false,
        };

        const engine = new SessionEngine(session, this.journey, adapter, {
            logger: this.logger.child({ pathId }),
        });

        const steps: PathRunnerResult["steps"] = [];
        const visitedNodes: string[] = [];
        
        let currentPathIndex = 0;

        try {
            await engine.start();

            // Initial backfill of visited nodes (if engine auto-advanced)
            const initialNodeId = session.currentNodeId;
            const initialIndex = path.indexOf(initialNodeId);
            
            if (initialIndex !== -1) {
                for (let i = 0; i <= initialIndex; i++) {
                    visitedNodes.push(path[i]);
                }
                currentPathIndex = initialIndex;
            } else {
                 throw new Error(`Engine started at node ${initialNodeId} which is not in path ${path.join("->")}`);
            }

            // Max steps safety to prevent infinite loops in runner
            let safetyCounter = 0;
            const MAX_STEPS = 1000;

            while (session.status === "active" && safetyCounter++ < MAX_STEPS) {
                const currentNodeId = session.currentNodeId;
                
                // Track visited
                if (visitedNodes.length === 0 || visitedNodes[visitedNodes.length - 1] !== currentNodeId) {
                    visitedNodes.push(currentNodeId);
                }

                // Check if done
                if (currentNodeId === path[path.length - 1]) {
                     steps.push({ nodeId: currentNodeId, action: "finish", details: "Reached end of path" });
                     break;
                }

                // Verify we are still on path
                const foundIndex = path.indexOf(currentNodeId, currentPathIndex);
                if (foundIndex === -1) {
                     throw new Error(`Engine diverged from path. Node ${currentNodeId} is not in path ${path.join("->")}`);
                }
                currentPathIndex = foundIndex;

                if (currentPathIndex === path.length - 1) {
                    steps.push({ nodeId: currentNodeId, action: "finish", details: "Reached end of logical path" });
                    break;
                }

                const nextNodeId = path[currentPathIndex + 1];
                const edge = this.journey.edges.find(e => e.source === currentNodeId && e.target === nextNodeId);

                if (!edge) {
                     throw new Error(`No edge found between ${currentNodeId} and ${nextNodeId}`);
                }

                const currentNode = this.journey.nodes.find(n => n.id === currentNodeId);
                if (!currentNode) throw new Error(`Node ${currentNodeId} not found`);

                // PERFORM ACTION
                let actionPromise: Promise<any>;

                if (currentNode.data.type === "message" || currentNode.data.type === "questionnaire") {
                     if (edge.sourceHandle) {
                          steps.push({ nodeId: currentNodeId, action: "click", details: `Button ${edge.sourceHandle}` });
                          actionPromise = adapter.simulateButtonClick(edge.sourceHandle, session.userId, session.sessionId);
                     } else if (edge.sourceHandle === "timer" || edge.edgeType === "timer") {
                          steps.push({ nodeId: currentNodeId, action: "timer", details: "Forcing timer transition" });
                          actionPromise = engine.forceEdgeTransition(edge.id);
                     } else {
                          steps.push({ nodeId: currentNodeId, action: "text", details: "Simulating text input" });
                          actionPromise = adapter.simulateMessage("test input", session.userId, session.sessionId);
                     }
                } 
                else if (currentNode.data.type === "wait") {
                     steps.push({ nodeId: currentNodeId, action: "wait_skip", details: "Skipping wait" });
                     actionPromise = engine.forceEdgeTransition(edge.id);
                }
                else {
                    // For auto-nodes, just nudge it if stuck
                     steps.push({ nodeId: currentNodeId, action: "force", details: `Forcing transition from ${currentNode.data.type}` });
                     actionPromise = engine.forceEdgeTransition(edge.id);
                }

                await actionPromise;

                // WAIT FOR TRANSITION - IMPROVED
                // Wait for the node ID to change OR status to change
                const startWaitTime = Date.now();
                while (session.currentNodeId === currentNodeId && session.status === "active") {
                    if (Date.now() - startWaitTime > 1000) {
                        break; // Timeout after 1s
                    }
                    await new Promise(r => setTimeout(r, 20));
                }

                // One final check and push if we moved
                if (session.currentNodeId !== currentNodeId) {
                     visitedNodes.push(session.currentNodeId);
                }
            }

            if (session.status === "error") {
                return {
                    pathId,
                    success: false,
                    error: "Session ended in error state",
                    stack: undefined,
                    visitedNodes,
                    steps
                };
            }

            return {
                pathId,
                success: true,
                visitedNodes,
                steps
            };

        } catch (error) {
            return {
                pathId,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                visitedNodes,
                steps
            };
        }
    }
}

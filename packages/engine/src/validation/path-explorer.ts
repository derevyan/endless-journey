import { JourneyConfig } from "@journey/schemas";
import { Graph, buildGraph } from "./graph-utils";

export interface PathExplorerOptions {
  /** Maximum depth of path to explore (default: 100) */
  maxDepth?: number;
  /** Maximum number of paths to collect (default: 1000) */
  maxPaths?: number;
  /** Whether to include paths that end in dead ends (non-End nodes) (default: true) */
  includeDeadEnds?: boolean;
}

export class PathExplorer {
  private graph: Graph;

  constructor(journey: JourneyConfig) {
    this.graph = buildGraph(journey);
  }

  /**
   * Find all logical paths from start to end nodes using DFS.
   */
  public findPaths(options: PathExplorerOptions = {}): string[][] {
    const { 
      maxDepth = 100, 
      maxPaths = 1000,
      includeDeadEnds = true 
    } = options;
    
    const paths: string[][] = [];
    
    if (!this.graph.startNodeId) {
      return paths;
    }

    this.dfs({
      currentId: this.graph.startNodeId,
      currentPath: [],
      visitedInPath: new Set<string>(),
      paths,
      maxDepth,
      maxPaths,
      includeDeadEnds
    });

    return paths;
  }

  private dfs(ctx: {
    currentId: string;
    currentPath: string[];
    visitedInPath: Set<string>;
    paths: string[][];
    maxDepth: number;
    maxPaths: number;
    includeDeadEnds: boolean;
  }) {
    // Stop if we found enough paths
    if (ctx.paths.length >= ctx.maxPaths) return;

    // Stop if path is too deep
    if (ctx.currentPath.length >= ctx.maxDepth) return;

    const { currentId } = ctx;

    // Cycle detection for current path
    if (ctx.visitedInPath.has(currentId)) {
        // We hit a cycle. We end this path here to avoid infinite recursion.
        // We include the repeating node to show the loop.
        ctx.paths.push([...ctx.currentPath, currentId]);
        return;
    }

    const newPath = [...ctx.currentPath, currentId];
    const newVisited = new Set(ctx.visitedInPath);
    newVisited.add(currentId);

    // Check if End Node
    if (this.graph.endNodeIds.includes(currentId)) {
      ctx.paths.push(newPath);
      return;
    }

    // Get outgoing edges
    const edges = this.graph.outEdges.get(currentId) || [];

    // Check if Dead End (no outgoing edges but not an End Node)
    if (edges.length === 0) {
      if (ctx.includeDeadEnds) {
        ctx.paths.push(newPath);
      }
      return;
    }

    // Recurse
    for (const edge of edges) {
      this.dfs({
        ...ctx,
        currentId: edge.target,
        currentPath: newPath,
        visitedInPath: newVisited
      });
      
      // Optimization: check maxPaths again to abort early
      if (ctx.paths.length >= ctx.maxPaths) return;
    }
  }
}

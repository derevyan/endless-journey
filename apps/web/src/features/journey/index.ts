/**
 * Journey Feature - Consolidated Exports
 * @module features/journey
 *
 * Unified journey feature containing:
 * - nodes: React Flow node components and configuration
 * - builder: Journey canvas and editor UI
 * - simulator: Journey testing and playback
 * - hooks: Journey-specific navigation and utilities
 */

// Nodes
export * from "../nodes/journey";

// Builder (formerly journey-editor)
export * from "./builder";

// Simulator
export * from "./simulator";

// Journey-specific hooks
export * from "./hooks";

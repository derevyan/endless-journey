/**
 * Registry Exports
 *
 * Barrel file for all node registries.
 * Import from here to access form registry with built-in fields registered.
 *
 * @module features/nodes/journey/registry
 */

// Register built-in field definitions via side-effect import
import "../forms/field-definitions";

// Export registries
export { formRegistry, type FormHandlers } from "./form-registry";

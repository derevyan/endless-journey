/**
 * useArrayField - Generic array CRUD hook for form fields
 *
 * Eliminates duplicate add/update/remove/reorder patterns found in:
 * - message-node-editor.tsx (buttons)
 * - questionnaire-node-editor.tsx (questions + buttons)
 * - webhook-node-editor.tsx (headers)
 *
 * @module features/nodes/journey/hooks/use-array-field
 */

import { useCallback } from "react";
import { useStore } from "@tanstack/react-store";
import type { NodeEditorFormApi, FormStoreState } from "../forms/form-types";

/**
 * Item with required ID for array management.
 * Only requires `id` field - no index signature needed.
 */
interface ArrayItem {
  id: string;
}

/**
 * Return type for useArrayField hook
 */
export interface UseArrayFieldReturn<T extends ArrayItem> {
  /** Current items in the array */
  items: T[];

  /** Add a new item to the array */
  add: (item: T) => void;

  /** Update an item by index */
  updateByIndex: (index: number, updates: Partial<T>) => void;

  /** Update an item by ID */
  updateById: (id: string, updates: Partial<T>) => void;

  /** Remove an item by index */
  removeByIndex: (index: number) => void;

  /** Remove an item by ID */
  removeById: (id: string) => void;

  /** Move an item from one index to another */
  move: (fromIndex: number, toIndex: number) => void;

  /** Replace all items */
  setItems: (items: T[]) => void;

  /** Get item by index */
  getByIndex: (index: number) => T | undefined;

  /** Get item by ID */
  getById: (id: string) => T | undefined;

  /** Check if array is empty */
  isEmpty: boolean;

  /** Number of items */
  count: number;
}

/**
 * Generic array field management hook for TanStack Form fields.
 *
 * Provides CRUD operations and helpers for managing array fields in node editors.
 *
 * @example
 * ```tsx
 * // In MessageNodeEditor for buttons
 * const buttons = useArrayField<ButtonConfig>(form, "buttons");
 *
 * // Add button
 * buttons.add({ id: generateButtonId(), text: "" });
 *
 * // Update button text
 * buttons.updateByIndex(index, { text: newText });
 *
 * // Remove button
 * buttons.removeByIndex(index);
 * ```
 *
 * @example
 * ```tsx
 * // In QuestionnaireNodeEditor for questions
 * const questions = useArrayField<Question>(form, "questions");
 *
 * // Add question
 * questions.add({ id: generateQuestionId(), content: "", responseType: "buttons", buttons: [] });
 *
 * // Update question
 * questions.updateById(questionId, { content: newContent });
 *
 * // Remove question
 * questions.removeById(questionId);
 * ```
 */
export function useArrayField<T extends ArrayItem>(
  form: NodeEditorFormApi,
  fieldName: string
): UseArrayFieldReturn<T> {
  // Subscribe to field value changes via useStore (triggers re-render when value changes)
  const items = useStore(form.store, (state: FormStoreState) => {
    return (state.values[fieldName] as T[] | undefined) ?? [];
  });

  // Add item
  const add = useCallback(
    (item: T) => {
      const current = (form.getFieldValue(fieldName) as T[] | undefined) ?? [];
      form.setFieldValue(fieldName, [...current, item]);
    },
    [form, fieldName]
  );

  // Update by index
  const updateByIndex = useCallback(
    (index: number, updates: Partial<T>) => {
      const current = (form.getFieldValue(fieldName) as T[] | undefined) ?? [];
      if (index < 0 || index >= current.length) return;

      const updated = current.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      );
      form.setFieldValue(fieldName, updated);
    },
    [form, fieldName]
  );

  // Update by ID
  const updateById = useCallback(
    (id: string, updates: Partial<T>) => {
      const current = (form.getFieldValue(fieldName) as T[] | undefined) ?? [];
      const updated = current.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      );
      form.setFieldValue(fieldName, updated);
    },
    [form, fieldName]
  );

  // Remove by index
  const removeByIndex = useCallback(
    (index: number) => {
      const current = (form.getFieldValue(fieldName) as T[] | undefined) ?? [];
      if (index < 0 || index >= current.length) return;

      form.setFieldValue(
        fieldName,
        current.filter((_, i) => i !== index)
      );
    },
    [form, fieldName]
  );

  // Remove by ID
  const removeById = useCallback(
    (id: string) => {
      const current = (form.getFieldValue(fieldName) as T[] | undefined) ?? [];
      form.setFieldValue(
        fieldName,
        current.filter((item) => item.id !== id)
      );
    },
    [form, fieldName]
  );

  // Move item (for drag-and-drop reordering)
  const move = useCallback(
    (fromIndex: number, toIndex: number) => {
      const current = (form.getFieldValue(fieldName) as T[] | undefined) ?? [];
      if (
        fromIndex < 0 ||
        fromIndex >= current.length ||
        toIndex < 0 ||
        toIndex >= current.length ||
        fromIndex === toIndex
      ) {
        return;
      }

      const updated = [...current];
      const [removed] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, removed);
      form.setFieldValue(fieldName, updated);
    },
    [form, fieldName]
  );

  // Replace all items
  const setItems = useCallback(
    (newItems: T[]) => {
      form.setFieldValue(fieldName, newItems);
    },
    [form, fieldName]
  );

  // Get by index
  const getByIndex = useCallback(
    (index: number): T | undefined => {
      const current = (form.getFieldValue(fieldName) as T[] | undefined) ?? [];
      return current[index];
    },
    [form, fieldName]
  );

  // Get by ID
  const getById = useCallback(
    (id: string): T | undefined => {
      const current = (form.getFieldValue(fieldName) as T[] | undefined) ?? [];
      return current.find((item) => item.id === id);
    },
    [form, fieldName]
  );

  return {
    items,
    add,
    updateByIndex,
    updateById,
    removeByIndex,
    removeById,
    move,
    setItems,
    getByIndex,
    getById,
    isEmpty: items.length === 0,
    count: items.length,
  };
}

/**
 * Hook for nested array fields (e.g., questions[i].buttons)
 *
 * Provides operations on a specific item's nested array.
 *
 * @example
 * ```tsx
 * // Managing buttons within a specific question
 * const questionButtons = useNestedArrayField<Question, ButtonConfig>(
 *   form,
 *   "questions",
 *   questionId,
 *   "buttons"
 * );
 *
 * questionButtons.add({ id: generateButtonId(), text: "" });
 * questionButtons.updateByIndex(0, { text: "Yes" });
 * ```
 */
export function useNestedArrayField<
  TParent extends ArrayItem,
  TChild extends ArrayItem
>(
  form: NodeEditorFormApi,
  parentFieldName: string,
  parentId: string,
  childFieldName: keyof TParent & string
): UseArrayFieldReturn<TChild> {
  // Subscribe to parent field value changes via useStore (triggers re-render when value changes)
  const items = useStore(form.store, (state: FormStoreState) => {
    const parents = (state.values[parentFieldName] as TParent[] | undefined) ?? [];
    const parent = parents.find((p) => p.id === parentId);
    return ((parent?.[childFieldName] as TChild[] | undefined) ?? []) as TChild[];
  });

  // Helper to update parent's child array
  const updateChildArray = useCallback(
    (updater: (children: TChild[]) => TChild[]) => {
      const parents = (form.getFieldValue(parentFieldName) as TParent[] | undefined) ?? [];
      const updatedParents = parents.map((parent) => {
        if (parent.id !== parentId) return parent;
        const children = ((parent[childFieldName] as TChild[] | undefined) ?? []) as TChild[];
        return { ...parent, [childFieldName]: updater(children) };
      });
      form.setFieldValue(parentFieldName, updatedParents);
    },
    [form, parentFieldName, parentId, childFieldName]
  );

  const add = useCallback(
    (item: TChild) => updateChildArray((children) => [...children, item]),
    [updateChildArray]
  );

  const updateByIndex = useCallback(
    (index: number, updates: Partial<TChild>) => {
      updateChildArray((children) =>
        children.map((child, i) => (i === index ? { ...child, ...updates } : child))
      );
    },
    [updateChildArray]
  );

  const updateById = useCallback(
    (id: string, updates: Partial<TChild>) => {
      updateChildArray((children) =>
        children.map((child) => (child.id === id ? { ...child, ...updates } : child))
      );
    },
    [updateChildArray]
  );

  const removeByIndex = useCallback(
    (index: number) => {
      updateChildArray((children) => children.filter((_, i) => i !== index));
    },
    [updateChildArray]
  );

  const removeById = useCallback(
    (id: string) => {
      updateChildArray((children) => children.filter((child) => child.id !== id));
    },
    [updateChildArray]
  );

  const move = useCallback(
    (fromIndex: number, toIndex: number) => {
      updateChildArray((children) => {
        if (
          fromIndex < 0 ||
          fromIndex >= children.length ||
          toIndex < 0 ||
          toIndex >= children.length ||
          fromIndex === toIndex
        ) {
          return children;
        }
        const updated = [...children];
        const [removed] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, removed);
        return updated;
      });
    },
    [updateChildArray]
  );

  const setItems = useCallback(
    (newItems: TChild[]) => updateChildArray(() => newItems),
    [updateChildArray]
  );

  const getByIndex = useCallback(
    (index: number): TChild | undefined => items[index],
    [items]
  );

  const getById = useCallback(
    (id: string): TChild | undefined => items.find((item) => item.id === id),
    [items]
  );

  return {
    items,
    add,
    updateByIndex,
    updateById,
    removeByIndex,
    removeById,
    move,
    setItems,
    getByIndex,
    getById,
    isEmpty: items.length === 0,
    count: items.length,
  };
}

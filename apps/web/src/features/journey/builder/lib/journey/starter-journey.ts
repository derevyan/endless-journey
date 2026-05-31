/**
 * Starter Journey Template
 *
 * Default journey configuration created for new organisations.
 * Provides a simple working example: START → Message → Wait → Message → END
 *
 * @module lib/starter-journey
 */

import type { JourneyConfig } from "@journey/schemas";

/**
 * Metadata for the starter journey
 */
export const STARTER_JOURNEY_METADATA = {
  name: "Getting Started",
  description: "Your first journey - edit or replace this template",
};

/**
 * Starter journey configuration
 * A simple flow demonstrating basic node types and timer edges
 */
export const STARTER_JOURNEY_CONFIG: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      data: {
        label: "START",
        type: "start",
        schemaVersion: 1,
        content: "Entry point for a new journey.",
      },
      position: {
        x: 0,
        y: 0,
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: "1.0.0",
        status: "draft",
        notes: "Starter template: begin flow",
        custom: {},
      },
    },
    {
      id: "msg-1",
      type: "custom",
      data: {
        label: "Welcome Message",
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        content: "Thanks for joining! This is your first touchpoint.",
        timer: {
          seconds: 300,
        },
      },
      position: {
        x: 0,
        y: 160,
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: "1.0.0",
        status: "draft",
        notes: "Starter template: initial message",
        custom: {},
      },
    },
    {
      id: "msg-2",
      type: "custom",
      data: {
        label: "Follow-up Message",
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        content: "Checking in—ready for the next step?",
      },
      position: {
        x: 0,
        y: 480,
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: "1.0.0",
        status: "draft",
        notes: "Starter template: second message",
        custom: {},
      },
    },
    {
      id: "end",
      type: "custom",
      data: {
        label: "END",
        type: "end",
        schemaVersion: 1,
        content: "Close out the starter journey.",
      },
      position: {
        x: 0,
        y: 640,
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: "1.0.0",
        status: "draft",
        notes: "Starter template: end state",
        custom: {},
      },
    },
  ],
  edges: [
    {
      id: "e-start-msg1",
      source: "start",
      target: "msg-1",
      label: "start",
      edgeType: "default",
      style: {
        stroke: "#22c55e",
        strokeWidth: 2,
      },
      animated: false,
    },
    {
      id: "e-msg2-end",
      source: "msg-2",
      target: "end",
      label: "complete",
      edgeType: "default",
      style: {
        stroke: "#22c55e",
        strokeWidth: 2,
      },
      animated: false,
    },
    {
      id: "timer-msg-1-msg-2",
      source: "msg-1",
      target: "msg-2",
      sourceHandle: "timer",
      label: "5m",
      edgeType: "timer",
      style: {
        stroke: "#f97316",
        strokeWidth: 2,
        strokeDasharray: "8,4",
      },
      animated: false,
    },
  ],
};

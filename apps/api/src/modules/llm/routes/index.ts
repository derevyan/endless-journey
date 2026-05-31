/**
 * LLM Routes Composition
 *
 * Mounts all LLM-related sub-routes under /api/llm:
 * - /api/llm/models - Model registry (public)
 * - /api/llm/tools - Agent tools discovery (protected: workflow:read)
 * - /api/llm/audio - STT/TTS (protected: settings:read)
 * - /api/llm/voices - Voice discovery (protected: settings:read)
 *
 * @module modules/llm/routes
 */

import type { Variables } from "../../../lib/auth-helpers";
import { Hono } from "hono";

import { audio } from "./audio";
import { models } from "./models";
import { tools } from "./tools";
import { voices } from "./voices";

const llm = new Hono<{ Variables: Variables }>();

// Mount sub-routers with different auth requirements
llm.route("/models", models); // Public
llm.route("/tools", tools); // Protected: workflow:read
llm.route("/audio", audio); // Protected: settings:read
llm.route("/voices", voices); // Protected: settings:read

export { llm };

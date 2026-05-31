/**
 * Voice API Routes
 *
 * Provides endpoints for discovering available TTS voices:
 * - GET /api/llm/voices/elevenlabs - Get ElevenLabs voices (with API fallback)
 *
 * Auth: Protected (settings:read)
 *
 * @module modules/llm/routes/voices
 */

import { createLogger, serializeError } from "@journey/logger";
import { AUDIO_CONFIG, type VoiceInfo, type VoicesResponse } from "@journey/schemas/config";

import { createProtectedRouter } from "../../../lib/protected-router";
import { redisCacheService } from "../../../services/redis-cache-service";

const log = createLogger("api:llm:voices");

// Cache configuration for ElevenLabs voices (rarely change - monthly at most)
const ELEVENLABS_CACHE_KEY = "elevenlabs:voices";
const ELEVENLABS_CACHE_TTL = 60 * 60 * 24; // 24 hours

export const voices = createProtectedRouter({
  defaultPermission: { resource: "settings", action: "read" },
});

// =============================================================================
// GET /elevenlabs - Get ElevenLabs voices
// =============================================================================

/**
 * Fetch available ElevenLabs voices
 *
 * Tries to fetch from ElevenLabs API first, falls back to hardcoded list if:
 * - API key not configured
 * - API request fails
 *
 * Returns { voices: VoiceInfo[], source: "api" | "hardcoded" | "cached" }
 */
voices.get("/elevenlabs", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const refresh = c.req.query("refresh") === "true";

  const requestLog = log.child({ userId: user.id, orgId: organization.id });
  requestLog.debug({ refresh }, "voices:elevenlabs:start");

  // 1. Check Redis cache first (shared across all users) - skip if refresh requested
  if (!refresh) {
    try {
      const cached = await redisCacheService.get<VoicesResponse>(ELEVENLABS_CACHE_KEY);
      if (cached) {
        requestLog.debug({ voiceCount: cached.voices.length }, "voices:elevenlabs:cache-hit");
        return c.json({ ...cached, source: "cached" as const });
      }
    } catch {
      // Cache miss or error - proceed to fetch
      requestLog.debug({}, "voices:elevenlabs:cache-miss");
    }
  } else {
    requestLog.info({}, "voices:elevenlabs:refresh-requested");
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;

  // If no API key, return hardcoded voices (don't cache hardcoded)
  if (!apiKey) {
    requestLog.debug({}, "voices:elevenlabs:noApiKey:usingHardcoded");
    return c.json({
      voices: AUDIO_CONFIG.elevenlabs.voices,
      source: "hardcoded",
    });
  }

  try {
    // Fetch BOTH default AND personal voices in parallel
    // v2 API requires explicit voice_type - without it, only "default" voices are returned
    const [defaultResponse, personalResponse] = await Promise.all([
      fetch("https://api.elevenlabs.io/v2/voices?voice_type=default&page_size=100", {
        headers: { "xi-api-key": apiKey, Accept: "application/json" },
      }),
      fetch("https://api.elevenlabs.io/v2/voices?voice_type=saved&page_size=100", {
        headers: { "xi-api-key": apiKey, Accept: "application/json" },
      }),
    ]);

    // If both fail, return hardcoded
    if (!defaultResponse.ok && !personalResponse.ok) {
      requestLog.warn(
        { defaultStatus: defaultResponse.status, personalStatus: personalResponse.status },
        "voices:elevenlabs:bothApiFailed"
      );
      return c.json({
        voices: AUDIO_CONFIG.elevenlabs.voices,
        source: "hardcoded",
      });
    }

    type ElevenLabsVoice = {
      voice_id: string;
      name: string;
      category?: "premade" | "cloned" | "generated" | "professional";
      labels?: { gender?: string };
      preview_url?: string;
    };

    // Parse responses - handle partial failures gracefully
    const defaultData = defaultResponse.ok
      ? ((await defaultResponse.json()) as { voices: ElevenLabsVoice[] })
      : { voices: [] };
    const personalData = personalResponse.ok
      ? ((await personalResponse.json()) as { voices: ElevenLabsVoice[] })
      : { voices: [] };

    requestLog.debug(
      { defaultCount: defaultData.voices.length, personalCount: personalData.voices.length },
      "voices:elevenlabs:fetched"
    );

    // Merge results - personal voices first (appear in "My Voices" group)
    const allVoices = [...personalData.voices, ...defaultData.voices];

    // Map API response to our voice format with category info
    const apiVoices: VoiceInfo[] = allVoices.map((v) => ({
      id: v.voice_id,
      label: v.name,
      gender: v.labels?.gender ?? "neutral",
      preview_url: v.preview_url,
      category: v.category,
    }));

    const result: VoicesResponse = { voices: apiVoices, source: "api" };

    // 2. Cache the successful API response in Redis
    try {
      await redisCacheService.set(ELEVENLABS_CACHE_KEY, result, {
        ttlSeconds: ELEVENLABS_CACHE_TTL,
      });
      requestLog.info({ voiceCount: apiVoices.length }, "voices:elevenlabs:cached");
    } catch {
      // Cache write failed - not critical, continue
      requestLog.warn({}, "voices:elevenlabs:cache-write-failed");
    }

    requestLog.info({ voiceCount: apiVoices.length }, "voices:elevenlabs:success");

    return c.json(result);
  } catch (error) {
    requestLog.error({ err: serializeError(error) }, "voices:elevenlabs:error");
    return c.json({
      voices: AUDIO_CONFIG.elevenlabs.voices,
      source: "hardcoded",
    });
  }
});

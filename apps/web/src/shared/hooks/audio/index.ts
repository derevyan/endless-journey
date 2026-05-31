/**
 * Audio Hooks
 *
 * Hooks for audio recording, playback, and voice chat interactions.
 *
 * @module hooks/audio
 */

export {
  useAudioRecorder,
  type UseAudioRecorderOptions,
  type UseAudioRecorderResult,
} from "./use-audio-recorder";

export {
  useAudioPlayer,
  type UseAudioPlayerOptions,
  type UseAudioPlayerResult,
} from "./use-audio-player";

export {
  useVoiceChat,
  type UseVoiceChatOptions,
  type UseVoiceChatResult,
  type VoiceChatStatus,
} from "./use-voice-chat";

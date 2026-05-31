/**
 * Blade Runner - Non-blocking Key Handler
 *
 * Handles keyboard input during test execution without blocking.
 * Supports interactive controls like pause, quit, speed adjustment.
 *
 * @module engine/testing/blade-runner/key-handler
 */

import { showCursor } from "./ui";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Callbacks for key events
 */
export interface KeyHandlerCallbacks {
  onQuit: () => void;
  onPause: () => void;
  onResume: () => void;
  onFailFastToggle: () => void;
  onSpeedUp: () => void;
  onSlowDown: () => void;
}

// =============================================================================
// KEY HANDLER
// =============================================================================

/**
 * Non-blocking key handler for dashboard controls
 */
export class KeyHandler {
  private active = false;
  private paused = false;
  private callbacks: KeyHandlerCallbacks | null = null;
  private dataHandler: ((data: Buffer) => void) | null = null;

  /**
   * Start listening for key events
   */
  start(callbacks: KeyHandlerCallbacks): void {
    if (!process.stdin.isTTY) {
      // Not a TTY, skip key handling
      return;
    }

    this.callbacks = callbacks;
    this.active = true;

    // Enable raw mode
    process.stdin.setRawMode(true);
    process.stdin.resume();

    // Create handler
    this.dataHandler = (data: Buffer) => {
      const key = data.toString().toLowerCase();
      this.handleKey(key);
    };

    process.stdin.on("data", this.dataHandler);
  }

  /**
   * Stop listening for key events
   */
  stop(): void {
    if (!this.active) return;

    this.active = false;

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    if (this.dataHandler) {
      process.stdin.off("data", this.dataHandler);
      this.dataHandler = null;
    }

    this.callbacks = null;
  }

  /**
   * Check if handler is active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Handle a key press
   */
  private handleKey(key: string): void {
    if (!this.callbacks) return;

    // Handle Ctrl+C
    if (key === "\x03") {
      this.stop();
      showCursor();
      this.callbacks.onQuit();
      return;
    }

    switch (key) {
      case "q":
        this.stop();
        this.callbacks.onQuit();
        break;

      case "p":
        if (this.paused) {
          this.paused = false;
          this.callbacks.onResume();
        } else {
          this.paused = true;
          this.callbacks.onPause();
        }
        break;

      case "f":
        this.callbacks.onFailFastToggle();
        break;

      case "+":
      case "=":
        this.callbacks.onSpeedUp();
        break;

      case "-":
      case "_":
        this.callbacks.onSlowDown();
        break;

      // Ignore other keys
      default:
        break;
    }
  }
}

/**
 * Create a singleton key handler
 */
export function createKeyHandler(): KeyHandler {
  return new KeyHandler();
}

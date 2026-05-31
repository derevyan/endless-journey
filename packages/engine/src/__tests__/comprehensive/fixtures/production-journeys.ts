import type { ButtonConfig, JourneyConfig, NodeMetadata } from "@journey/schemas";

// Helper to create button config
const btn = (id: string, text: string, targetNodeId?: string): ButtonConfig => ({
  id,
  text,
  targetNodeId,
});

// Helper to create metadata
const createMetadata = (): NodeMetadata => ({
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  version: "1.0.0",
  status: "active",
});

/**
 * Complete SaaS Onboarding Journey
 *
 * Tests:
 * - START node with media and tag/variable actions
 * - MESSAGE nodes with all response types (auto, buttons, text, any)
 * - CONDITION nodes with both expression and rule-based evaluation
 * - WEBHOOK node with success/error paths and retry
 * - WAIT node for delays
 * - END node with final tags
 * - All edge types: default, timer, success, retry, exit, dropoff
 * - Tag operations (journey scope)
 * - Variable operations (journey scope)
 * - Cross-node data references
 */
export const onboardingJourney: JourneyConfig = {
  nodes: [
    // START: Welcome message with media
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Welcome",
        content: "👋 Welcome to our SaaS platform! Let's get you set up.",
        media: {
          type: "image",
          url: "https://example.com/welcome.png",
        },
        tagAction: {
          tags: {
            add: ["onboarding_started"],
          },
        },
        variableAction: {
          journeyOperations: [
            {
              op: "set",
              key: "onboarding_step",
              value: "welcome",
            },
          ],
        },
      },
      metadata: createMetadata(),
    },

    // MESSAGE: Ask for user role (buttons)
    {
      id: "ask-role",
      type: "custom",
      position: { x: 0, y: 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Ask Role",
        content: "What best describes your role?",
        buttons: [
          btn("btn-dev", "Developer", "role-condition"),
          btn("btn-designer", "Designer", "role-condition"),
          btn("btn-pm", "Product Manager", "role-condition"),
        ],
        responseType: "buttons",
        storeResponseAs: "user_role",
      },
      metadata: createMetadata(),
    },

    // CONDITION: Branch based on role (rule-based)
    {
      id: "role-condition",
      type: "custom",
      position: { x: 0, y: 200 },
      data: {
        type: "condition",
        schemaVersion: 1,
        label: "Role Check",
        rules: [
          {
            field: "user_role",
            operator: "equals",
            value: "btn-dev", // Button ID is stored, not text
          },
        ],
        rulesOperator: "or",
        branches: [
          {
            id: "technical",
            label: "Technical Role",
            isDefault: false,
          },
          {
            id: "non-technical",
            label: "Non-Technical Role",
            isDefault: true,
          },
        ],
      },
      metadata: createMetadata(),
    },

    // MESSAGE: Technical path - ask for tech stack (text input with timer)
    {
      id: "ask-tech-stack",
      type: "custom",
      position: { x: -200, y: 300 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Ask Tech Stack",
        content: "Great! What's your primary tech stack? (e.g., React, Vue, Angular)",
        responseType: "text",
        storeResponseAs: "tech_stack",
        timer: {
          seconds: 60,
        },
      },
      metadata: createMetadata(),
    },

    // MESSAGE: Non-technical path (auto response)
    {
      id: "non-tech-message",
      type: "custom",
      position: { x: 200, y: 300 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Non-Tech Welcome",
        content: "Perfect! We'll show you the features that matter most for your role.",
        responseType: "auto",
      },
      metadata: createMetadata(),
    },

    // MESSAGE: Timeout reminder
    {
      id: "timeout-reminder",
      type: "custom",
      position: { x: -400, y: 400 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Timeout Reminder",
        content: "No worries! You can always update this later in settings.",
        responseType: "auto",
      },
      metadata: createMetadata(),
    },

    // WEBHOOK: Create user profile with mock response
    {
      id: "create-profile",
      type: "custom",
      position: { x: 0, y: 500 },
      data: {
        type: "webhook",
        schemaVersion: 1,
        label: "Create Profile",
        url: "https://api.example.com/users/{{user.id}}/profile",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "{{user_role}}",
          techStack: "{{tech_stack}}",
          onboardingDate: "{{= new Date().toISOString() }}",
        }),
        auth: {
          type: "bearer",
          token: "test-token-12345",
        },
        successPath: "$.data",
        storeAs: "profile",
        errorHandling: "retry",
        retryCount: 2,
        timeoutMs: 10000,
        mockResponse: {
          enabled: true,
          statusCode: 200,
          body: {
            data: {
              profileId: "profile-123",
              status: "created",
            },
          },
          delay: 100,
        },
      },
      metadata: createMetadata(),
    },

    // MESSAGE: Profile creation success
    {
      id: "profile-success",
      type: "custom",
      position: { x: -200, y: 600 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Profile Created",
        content: "✅ Your profile has been created! ID: {{nodes.Create_Profile.profileId}}",
        responseType: "auto",
        tagAction: {
          tags: {
            add: ["profile_created", "success_path"],
          },
        },
      },
      metadata: createMetadata(),
    },

    // MESSAGE: Profile creation error
    {
      id: "profile-error",
      type: "custom",
      position: { x: 200, y: 600 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Profile Error",
        content: "⚠️ We couldn't create your profile right now. We'll retry automatically.",
        buttons: [
          btn("btn-try-again", "Try Again", "create-profile"),
          btn("btn-skip", "Skip for Now", "wait-processing"),
        ],
        responseType: "buttons",
        tagAction: {
          tags: {
            add: ["error_path"],
          },
        },
      },
      metadata: createMetadata(),
    },

    // WAIT: Give backend time to process
    {
      id: "wait-processing",
      type: "custom",
      position: { x: 0, y: 700 },
      data: {
        type: "wait",
        schemaVersion: 1,
        label: "Processing Wait",
        duration: {
          seconds: 2,
        },
        reason: "Waiting for backend to finish profile setup",
      },
      metadata: createMetadata(),
    },

    // MESSAGE: Final message with "any" response type
    {
      id: "final-message",
      type: "custom",
      position: { x: 0, y: 800 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: "Final Message",
        content: "All done! You can reply with questions or click Get Started.",
        buttons: [btn("btn-get-started", "Get Started", "end")],
        responseType: "any",
        storeResponseAs: "final_response",
      },
      metadata: createMetadata(),
    },

    // END: Completion with final tags
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 900 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "Complete",
        content: "🎉 You're all set! Welcome to the platform!",
        tagAction: {
          tags: {
            add: ["onboarding_completed"],
            remove: ["onboarding_started"],
          },
        },
        variableAction: {
          journeyOperations: [
            {
              op: "set",
              key: "onboarding_completed_at",
              value: new Date().toISOString(),
            },
          ],
        },
      },
      metadata: createMetadata(),
    },

    // END: Exit path
    {
      id: "exit-node",
      type: "custom",
      position: { x: 400, y: 700 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "Exit Onboarding",
        content: "No problem! You can complete setup anytime from your dashboard.",
        tagAction: {
          tags: {
            add: ["onboarding_skipped"],
          },
        },
      },
      metadata: createMetadata(),
    },

    // END: Dropoff path
    {
      id: "dropoff-node",
      type: "custom",
      position: { x: -400, y: 500 },
      data: {
        type: "end",
        schemaVersion: 1,
        label: "Dropoff",
        content: "We noticed you left. Come back anytime!",
        tagAction: {
          tags: {
            add: ["onboarding_abandoned"],
          },
        },
      },
      metadata: createMetadata(),
    },
  ],

  edges: [
    // Start flow
    {
      id: "e1",
      source: "start",
      target: "ask-role",
      edgeType: "default",
      label: "Auto transition",
    },

    // Role selection buttons
    {
      id: "e2-dev",
      source: "ask-role",
      target: "role-condition",
      edgeType: "default",
      label: "Developer",
    },
    {
      id: "e2-designer",
      source: "ask-role",
      target: "role-condition",
      edgeType: "default",
      label: "Designer",
    },
    {
      id: "e2-pm",
      source: "ask-role",
      target: "role-condition",
      edgeType: "default",
      label: "Product Manager",
    },

    // Role condition branches
    {
      id: "e3-technical",
      source: "role-condition",
      target: "ask-tech-stack",
      edgeType: "default",
      sourceHandle: "technical",
      label: "Technical Role",
    },
    {
      id: "e3-non-technical",
      source: "role-condition",
      target: "non-tech-message",
      edgeType: "default",
      sourceHandle: "non-technical",
      label: "Non-Technical Role",
    },

    // Tech stack timeout (timer edge)
    {
      id: "e4-timeout",
      source: "ask-tech-stack",
      target: "timeout-reminder",
      edgeType: "timer",
      sourceHandle: "timer",
      label: "Timeout",
    },
    {
      id: "e4-text",
      source: "ask-tech-stack",
      target: "create-profile",
      edgeType: "default",
      label: "Text Response",
    },

    // Dropoff edge (user abandons during tech stack question)
    {
      id: "e4-dropoff",
      source: "ask-tech-stack",
      target: "dropoff-node",
      edgeType: "dropoff",
      label: "Abandoned",
    },

    // Non-tech and timeout paths to webhook
    {
      id: "e5-non-tech",
      source: "non-tech-message",
      target: "create-profile",
      edgeType: "default",
    },
    {
      id: "e5-timeout-reminder",
      source: "timeout-reminder",
      target: "create-profile",
      edgeType: "default",
    },

    // Webhook success/error paths
    {
      id: "e6-success",
      source: "create-profile",
      target: "profile-success",
      edgeType: "success",
      label: "Success",
    },
    {
      id: "e6-error",
      source: "create-profile",
      target: "profile-error",
      edgeType: "retry",
      label: "Error",
    },

    // Profile error recovery
    {
      id: "e7-try-again",
      source: "profile-error",
      target: "create-profile",
      edgeType: "default",
      label: "Try Again",
    },
    {
      id: "e7-skip",
      source: "profile-error",
      target: "wait-processing",
      edgeType: "exit",
      label: "Skip for Now",
    },

    // Success path to wait
    {
      id: "e8-wait",
      source: "profile-success",
      target: "wait-processing",
      edgeType: "default",
    },

    // Wait to final message
    {
      id: "e9-final",
      source: "wait-processing",
      target: "final-message",
      edgeType: "default",
    },

    // Final message to end
    {
      id: "e10-button",
      source: "final-message",
      target: "end",
      edgeType: "default",
      label: "Get Started",
    },
    {
      id: "e10-text",
      source: "final-message",
      target: "end",
      edgeType: "default",
      label: "Text Response",
    },

    // Exit path from profile error
    {
      id: "e11-exit",
      source: "profile-error",
      target: "exit-node",
      edgeType: "exit",
      label: "Exit",
    },
  ],
};

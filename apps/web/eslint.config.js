import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import boundaries from "eslint-plugin-boundaries";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLButtonElement: "readonly",
        Element: "readonly",
        Event: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        CustomEvent: "readonly",
        ResizeObserver: "readonly",
        MutationObserver: "readonly",
        IntersectionObserver: "readonly",
        AbortController: "readonly",
        Response: "readonly",
        Request: "readonly",
        Headers: "readonly",
        EventSource: "readonly",
        WebSocket: "readonly",
        Worker: "readonly",
        MessagePort: "readonly",
        MessageChannel: "readonly",
        crypto: "readonly",
        performance: "readonly",
        queueMicrotask: "readonly",
        structuredClone: "readonly",
        atob: "readonly",
        btoa: "readonly",
        self: "readonly",
        globalThis: "readonly",
        // Node.js globals (for config files)
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        Buffer: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react: react,
      "react-hooks": reactHooks,
      boundaries: boundaries,
    },
    settings: {
      react: {
        version: "detect",
      },
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        // Feature modules - each feature is isolated
        {
          type: "feature",
          pattern: "src/features/*/**",
          capture: ["feature"],
        },
        // Global stores
        {
          type: "stores",
          pattern: "src/stores/**",
        },
        // Shared utilities and components
        {
          type: "shared",
          pattern: "src/shared/**",
        },
        // Components (legacy shared components)
        {
          type: "components",
          pattern: "src/components/**",
        },
        // Hooks (global hooks)
        {
          type: "hooks",
          pattern: "src/hooks/**",
        },
        // Routes
        {
          type: "routes",
          pattern: "src/routes/**",
        },
        // Data files
        {
          type: "data",
          pattern: "src/data/**",
        },
        // External packages
        {
          type: "packages",
          pattern: "@journey/*",
        },
      ],
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",

      // React rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Disable base rule in favor of TypeScript version
      "no-unused-vars": "off",
      "no-undef": "off", // TypeScript handles this

      // Import boundary rules
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            // Features can import from:
            // - Their own feature
            // - Shared kernel (shared, stores, components, hooks)
            // - External packages (@journey/*)
            // - Data files
            {
              from: ["feature"],
              allow: [
                ["feature", { feature: "${from.feature}" }], // Same feature
                "shared",
                "stores",
                "components",
                "hooks",
                "data",
                "packages",
              ],
            },
            // Shared can import from shared, components, packages, stores
            {
              from: ["shared"],
              allow: ["shared", "components", "packages", "stores", "hooks"],
            },
            // Stores can import from packages, shared (but NOT other stores)
            {
              from: ["stores"],
              allow: ["packages", "shared", "hooks"],
            },
            // Components can import from shared, packages, stores
            {
              from: ["components"],
              allow: ["components", "shared", "packages", "stores", "hooks"],
            },
            // Hooks can import from packages, shared, stores
            {
              from: ["hooks"],
              allow: ["packages", "shared", "stores", "hooks"],
            },
            // Routes can import from everything (they're the entry points)
            {
              from: ["routes"],
              allow: [
                "feature",
                "shared",
                "stores",
                "components",
                "hooks",
                "data",
                "packages",
              ],
            },
            // Data can only import from packages
            {
              from: ["data"],
              allow: ["packages", "data"],
            },
          ],
        },
      ],

      // Cross-feature import rule with documented exceptions
      // Note: boundaries/no-unknown is off because external npm packages are always allowed
      "boundaries/no-unknown": "off",
      "boundaries/no-ignored": "off",
    },
  },
  // Ignore patterns
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "*.config.js",
      "*.config.ts",
      "vite.config.ts",
      "vitest.config.ts",
      "playwright.config.ts",
      "tailwind.config.ts",
      "postcss.config.js",
      "tests/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/__tests__/**",
    ],
  },
];

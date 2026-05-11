// @ts-check
/**
 * ESLint flat config (ESLint 9+, Next 16 compatible).
 *
 * Migrated from .eslintrc (legacy eslintrc format) — all rules, plugins, and
 * settings from the original file are preserved. See TRIB-164.
 *
 * Run: eslint . --cache --max-warnings 0
 */

import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import pluginImport from "eslint-plugin-import";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";

// ─── Global ignores ───────────────────────────────────────────────────────────
const globalIgnores = [
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/.cache/**",
  "**/.eslintcache",
  "**/coverage/**",
  "**/test-results/**",
  "**/playwright-report/**",
  "**/reference-repos/**",
  "**/.worktrees/**",
  // Extension build outputs
  "**/packages/extension/.output/**",
  "**/packages/extension/.wxt/**",
];

// ─── Shared global variable definitions (replaces legacy "env" keys) ──────────
/** @type {Record<string, "readonly" | "writable">} */
const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  fetch: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  FormData: "readonly",
  Blob: "readonly",
  File: "readonly",
  FileReader: "readonly",
  Event: "readonly",
  EventTarget: "readonly",
  CustomEvent: "readonly",
  MessageEvent: "readonly",
  HTMLElement: "readonly",
  HTMLInputElement: "readonly",
  HTMLFormElement: "readonly",
  HTMLButtonElement: "readonly",
  HTMLDivElement: "readonly",
  HTMLSpanElement: "readonly",
  HTMLAnchorElement: "readonly",
  HTMLTextAreaElement: "readonly",
  HTMLSelectElement: "readonly",
  HTMLAudioElement: "readonly",
  HTMLCanvasElement: "readonly",
  HTMLIFrameElement: "readonly",
  HTMLImageElement: "readonly",
  HTMLOptionElement: "readonly",
  SVGElement: "readonly",
  SVGSVGElement: "readonly",
  ShadowRoot: "readonly",
  DOMRect: "readonly",
  CSSStyleDeclaration: "readonly",
  CSS: "readonly",
  Document: "readonly",
  Element: "readonly",
  Node: "readonly",
  NodeFilter: "readonly",
  NodeList: "readonly",
  DocumentFragment: "readonly",
  MutationRecord: "readonly",
  MutationObserver: "readonly",
  MutationObserverInit: "readonly",
  IntersectionObserver: "readonly",
  ResizeObserver: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  Request: "readonly",
  Response: "readonly",
  Headers: "readonly",
  ReadableStream: "readonly",
  WritableStream: "readonly",
  TransformStream: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  crypto: "readonly",
  performance: "readonly",
  history: "readonly",
  location: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  indexedDB: "readonly",
  WebSocket: "readonly",
  Worker: "readonly",
  SharedWorker: "readonly",
  ServiceWorker: "readonly",
  Audio: "readonly",
  AudioWorkletProcessor: "readonly",
  BlobEvent: "readonly",
  BlobPart: "readonly",
  HeadersInit: "readonly",
  History: "readonly",
  KeyboardEvent: "readonly",
  MediaRecorder: "readonly",
  MediaRecorderErrorEvent: "readonly",
  MediaStream: "readonly",
  RequestInit: "readonly",
  chrome: "readonly",
  registerProcessor: "readonly",
  sampleRate: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  requestIdleCallback: "readonly",
  queueMicrotask: "readonly",
  alert: "readonly",
  confirm: "readonly",
  prompt: "readonly",
  getComputedStyle: "readonly",
  matchMedia: "readonly",
  screen: "readonly",
  scrollTo: "readonly",
  scrollBy: "readonly",
  addEventListener: "readonly",
  removeEventListener: "readonly",
  dispatchEvent: "readonly",
  atob: "readonly",
  btoa: "readonly",
};

/** @type {Record<string, "readonly" | "writable">} */
const nodeGlobals = {
  process: "readonly",
  Buffer: "readonly",
  global: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  module: "readonly",
  require: "readonly",
  exports: "writable",
  setImmediate: "readonly",
  clearImmediate: "readonly",
};

/** @type {Record<string, "readonly" | "writable">} */
const es2021Globals = {
  Promise: "readonly",
  Set: "readonly",
  Map: "readonly",
  WeakMap: "readonly",
  WeakSet: "readonly",
  WeakRef: "readonly",
  Symbol: "readonly",
  Proxy: "readonly",
  Reflect: "readonly",
  BigInt: "readonly",
  globalThis: "readonly",
  AggregateError: "readonly",
  FinalizationRegistry: "readonly",
  Array: "readonly",
  Object: "readonly",
  String: "readonly",
  Number: "readonly",
  Boolean: "readonly",
  RegExp: "readonly",
  Error: "readonly",
  TypeError: "readonly",
  RangeError: "readonly",
  ReferenceError: "readonly",
  SyntaxError: "readonly",
  URIError: "readonly",
  EvalError: "readonly",
  Date: "readonly",
  Math: "readonly",
  JSON: "readonly",
  parseInt: "readonly",
  parseFloat: "readonly",
  isNaN: "readonly",
  isFinite: "readonly",
  encodeURI: "readonly",
  decodeURI: "readonly",
  encodeURIComponent: "readonly",
  decodeURIComponent: "readonly",
  undefined: "readonly",
  null: "readonly",
  Infinity: "readonly",
  NaN: "readonly",
  eval: "readonly",
  Function: "readonly",
  console: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  afterAll: "readonly",
  afterEach: "readonly",
  describe: "readonly",
  expect: "readonly",
  fail: "readonly",
  it: "readonly",
  jest: "readonly",
  test: "readonly",
};

const allGlobals = { ...browserGlobals, ...nodeGlobals, ...es2021Globals };

// ─── Import plugin settings ───────────────────────────────────────────────────
const importSettings = {
  "import/parsers": {
    "@typescript-eslint/parser": [".ts", ".tsx"],
  },
  "import/resolver": {
    typescript: {
      alwaysTryTypes: true,
    },
  },
};

// ─── Project-specific import/order rule (from legacy config) ──────────────────
const importOrderRule = {
  "import/order": [
    "error",
    {
      groups: [
        "builtin",
        "external",
        "internal",
        "parent",
        "sibling",
        "index",
      ],
      pathGroups: [
        {
          pattern: "./**/*.css",
          group: "sibling",
          position: "after",
        },
      ],
      "newlines-between": "always",
      warnOnUnassignedImports: true,
    },
  ],
};

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },

  // ── 1. Global ignores ────────────────────────────────────────────────────────
  { ignores: globalIgnores },

  // ── 2. ESLint recommended (JS baseline) ──────────────────────────────────────
  {
    ...js.configs.recommended,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: allGlobals,
    },
  },

  // ── 3. TypeScript — @typescript-eslint/recommended ───────────────────────────
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: allGlobals,
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
    settings: importSettings,
  },

  // ── 4. React — recommended + jsx-runtime ─────────────────────────────────────
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: pluginReact,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: allGlobals,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // plugin:react/recommended
      ...pluginReact.configs.recommended.rules,
      // plugin:react/jsx-runtime suppresses React-in-scope requirement
      ...pluginReact.configs["jsx-runtime"].rules,
      "react/no-unescaped-entities": "off",
    },
    settings: {
      react: { version: "detect" },
      ...importSettings,
    },
  },

  // ── 5. React Hooks ────────────────────────────────────────────────────────────
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    rules: {
      // v7 flat config uses "recommended-latest"
      ...pluginReactHooks.configs["recommended-latest"].rules,
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },

  // ── 6. Import plugin (recommended + typescript resolver) ──────────────────────
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      import: pluginImport,
    },
    settings: importSettings,
    rules: {
      ...pluginImport.flatConfigs.recommended.rules,
      ...pluginImport.flatConfigs.typescript.rules,
      ...importOrderRule,
      "import/no-named-as-default": "off",
      "import/no-named-as-default-member": "off",
    },
  },

  // ── 7. Prettier — must be last; disables conflicting formatting rules ──────────
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs}"],
    rules: {
      ...prettier.rules,
    },
  },
];

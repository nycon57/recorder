const fs = require("fs");
const path = require("path");

const js = require("@eslint/js");
const { FlatCompat } = require("@eslint/eslintrc");

const legacyConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, ".eslintrc"), "utf8")
);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = [
  {
    ignores: [
      ".next/**",
      ".agents/**",
      ".claude/**",
      ".git/**",
      ".ralph/**",
      ".swc/**",
      ".truetone/**",
      ".worktrees/**",
      "coverage/**",
      "documentation/**",
      "node_modules/**",
      "packages/*/dist/**",
      "packages/*/.output/**",
      "public/**",
    ],
  },
  ...compat.config(legacyConfig),
  {
    files: [
      "eslint.config.cjs",
      "jest.config.js",
      "next.config.js",
      "next.config.optimized.js",
      "playwright.config.ts",
      "postcss.config.js",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/order": "off",
    },
  },
  {
    files: ["jest.setup.js"],
    languageOptions: {
      globals: {
        jest: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

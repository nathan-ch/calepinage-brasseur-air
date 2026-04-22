import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "brasse2-data.js"]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "data/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser
      }
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  },
  {
    files: ["test/**/*.js", "eslint.config.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node
      }
    }
  }
];

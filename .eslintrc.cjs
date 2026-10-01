// .eslintrc.cjs — ESLint v8 para TypeScript + React (Vite + strict)
/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", "node_modules", ".eslintrc.cjs", "vite.config.ts", "postcss.config.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["react-refresh", "@typescript-eslint"],
  rules: {
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    // Non-null assertions son comunes con Supabase; quedan como warn, no error
    "@typescript-eslint/no-non-null-assertion": "warn",
    // Unused vars: error excepto _ prefix
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
    ],
    "prefer-const": "error",
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-empty": ["error", { allowEmptyCatch: false }],
  },
  overrides: [
    {
      // Los archivos de test pueden usar console.log
      files: ["src/test/**/*.ts"],
      rules: { "no-console": "off" }
    }
  ]
}

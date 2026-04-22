import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const outputDir = path.join(rootDir, "dist");
const outputFile = path.join(outputDir, "app.browser.js");

const sourceFiles = [
  "brasse2-data.js",
  "src/core/constants.js",
  "src/core/formatters.js",
  "src/app/dom.js",
  "src/app/state.js",
  "src/core/messages.js",
  "src/core/brasse2.js",
  "src/core/catalog.js",
  "src/core/ceilingGrid.js",
  "src/core/ceilingAssessment.js",
  "src/core/calepinage.js",
  "src/ui/catalog.js",
  "src/ui/planSvg.js",
  "src/ui/ceilingEditor.js",
  "src/ui/reportHeader.js",
  "src/ui/zonesEditor.js",
  "src/ui/results.js",
  "src/report/pdf.js",
  "src/main.js"
];

function stripImports(code) {
  return code.replace(/^import\s+[\s\S]*?;\n?/gm, "");
}

function stripExports(code) {
  return code
    .replace(/^export\s+function\s+/gm, "function ")
    .replace(/^export\s+const\s+/gm, "const ")
    .replace(/^export\s+let\s+/gm, "let ")
    .replace(/^export\s+class\s+/gm, "class ")
    .replace(/^export\s+\{[\s\S]*?\};?\n?/gm, "");
}

async function buildBrowserBundle() {
  const chunks = [];

  for (const relativePath of sourceFiles) {
    const absolutePath = path.join(rootDir, relativePath);
    const raw = await readFile(absolutePath, "utf8");
    const transformed = stripExports(stripImports(raw)).trim();

    chunks.push(`// ${relativePath}\n${transformed}`);
  }

  const bundle = `/* Generated file. Run "npm run build:browser" after editing src/. */
(function () {
  "use strict";

${chunks.join("\n\n")}
})();
`;

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, bundle, "utf8");
  process.stdout.write(`Bundle navigateur genere : ${path.relative(rootDir, outputFile)}\n`);
}

buildBrowserBundle().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

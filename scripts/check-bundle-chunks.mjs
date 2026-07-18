import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const assetsDir = path.join(distDir, "assets");
const indexHtmlPath = path.join(distDir, "index.html");

const maxInitialChunkBytes = 500 * 1024;
const warnInitialChunkBytes = 400 * 1024;
const maxInitialBundleBytes = 2 * 1024 * 1024;
const warnInitialBundleBytes = 1_800 * 1024;
const maxInitialBundleGzipBytes = 650 * 1024;
const warnInitialBundleGzipBytes = 600 * 1024;
const maxLazyChunkBytes = 750 * 1024;
const warnLazyChunkBytes = 600 * 1024;

const requiredChunkPrefixes = [
  "index-",
  "react-vendor-",
  "vendor-",
  "markdown-core-",
  "codemirror-core-",
  "codemirror-extensions-",
  "lezer-vendor-",
  "MarkdownPreview-",
  "liveCollaboration-",
  "collab-vendor-",
  "firebase-vendor-",
  "room-transport-vendor-",
  "posthog-vendor-",
];

const lazyOnlyPrefixes = [
  "MarkdownPreview-",
  "markdown-vendor-",
  "syntax-vendor-",
  "math-vendor-",
  "liveCollaboration-",
  "collab-vendor-",
  "firebase-vendor-",
  "room-transport-vendor-",
  "posthog-vendor-",
];

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

const files = await readdir(assetsDir);
const jsChunks = [];

for (const file of files) {
  if (!file.endsWith(".js")) {
    continue;
  }

  const filePath = path.join(assetsDir, file);
  const fileStat = await stat(filePath);
  jsChunks.push({ file, bytes: fileStat.size });
}

const indexHtml = await readFile(indexHtmlPath, "utf8");
const failures = [];
const warnings = [];

for (const chunk of jsChunks) {
  const isInitialChunk = indexHtml.includes(chunk.file);
  const maxChunkBytes = isInitialChunk ? maxInitialChunkBytes : maxLazyChunkBytes;
  const warnChunkBytes = isInitialChunk ? warnInitialChunkBytes : warnLazyChunkBytes;
  const chunkKind = isInitialChunk ? "initial" : "lazy";

  if (chunk.bytes > maxChunkBytes) {
    failures.push(
      `${chunk.file} is ${formatBytes(chunk.bytes)}; ${chunkKind} chunk limit is ${formatBytes(maxChunkBytes)}.`,
    );
  } else if (chunk.bytes > warnChunkBytes) {
    warnings.push(
      `${chunk.file} is ${formatBytes(chunk.bytes)}; ${chunkKind} warning threshold is ${formatBytes(warnChunkBytes)}.`,
    );
  }
}

const initialChunks = jsChunks.filter((chunk) => indexHtml.includes(chunk.file));
const initialBundleBytes = initialChunks.reduce((total, chunk) => total + chunk.bytes, 0);
const initialBundleGzipBytes = (
  await Promise.all(
    initialChunks.map(async (chunk) => gzipSync(await readFile(path.join(assetsDir, chunk.file))).byteLength),
  )
).reduce((total, bytes) => total + bytes, 0);

if (initialBundleBytes > maxInitialBundleBytes) {
  failures.push(
    `Initial JavaScript is ${formatBytes(initialBundleBytes)}; total limit is ${formatBytes(maxInitialBundleBytes)}.`,
  );
} else if (initialBundleBytes > warnInitialBundleBytes) {
  warnings.push(
    `Initial JavaScript is ${formatBytes(initialBundleBytes)}; total warning threshold is ${formatBytes(warnInitialBundleBytes)}.`,
  );
}

if (initialBundleGzipBytes > maxInitialBundleGzipBytes) {
  failures.push(
    `Initial JavaScript gzip size is ${formatBytes(initialBundleGzipBytes)}; total limit is ${formatBytes(maxInitialBundleGzipBytes)}.`,
  );
} else if (initialBundleGzipBytes > warnInitialBundleGzipBytes) {
  warnings.push(
    `Initial JavaScript gzip size is ${formatBytes(initialBundleGzipBytes)}; total warning threshold is ${formatBytes(warnInitialBundleGzipBytes)}.`,
  );
}

for (const prefix of requiredChunkPrefixes) {
  if (!jsChunks.some((chunk) => chunk.file.startsWith(prefix))) {
    failures.push(`Expected a ${prefix}*.js bundle chunk, but none was emitted.`);
  }
}

for (const prefix of lazyOnlyPrefixes) {
  const chunk = jsChunks.find((candidate) => candidate.file.startsWith(prefix));
  if (chunk && indexHtml.includes(chunk.file)) {
    failures.push(`${chunk.file} is referenced from index.html; it should stay lazy-loaded.`);
  }
}

const sortedChunks = [...jsChunks].sort((left, right) => right.bytes - left.bytes);

console.log("Bundle chunks:");
for (const chunk of sortedChunks) {
  console.log(`- ${chunk.file}: ${formatBytes(chunk.bytes)}`);
}
console.log(
  `Initial JavaScript total: ${formatBytes(initialBundleBytes)} raw, ${formatBytes(initialBundleGzipBytes)} gzip (${initialChunks.length} chunks).`,
);

if (warnings.length > 0) {
  console.warn("\nBundle warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (failures.length > 0) {
  console.error("\nBundle check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
}

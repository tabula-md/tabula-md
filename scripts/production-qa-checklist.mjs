import { spawn } from "node:child_process";

const targetUrl = process.env.TABULA_TEST_URL || "https://tabula.md";
const roomUrl = process.env.VITE_TABULA_ROOM_URL || "https://rooms.tabula.md";
const jsonUrl = process.env.VITE_TABULA_JSON_URL || "https://json.tabula.md";

const checklist = [
  `App: ${targetUrl}`,
  `Room service: ${roomUrl}`,
  `JSON snapshot service: ${jsonUrl}`,
  "Create a new document",
  "Share > Start session",
  "Join the #room link in a second browser",
  "Sync Enter, Backspace, line merge, long paragraph, undo/redo, and selection",
  "Confirm collaborator presence and tab-leave cleanup",
  "Create a Snapshot link",
  "Open the #json link and confirm replace/import",
  "Reload and confirm local restore",
];

console.log("Tabula production QA checklist");
for (const item of checklist) {
  console.log(`- ${item}`);
}
console.log("");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCommand, ["run", "test:browser:production"], {
  env: {
    ...process.env,
    TABULA_TEST_URL: targetUrl,
    VITE_TABULA_ROOM_URL: roomUrl,
    VITE_TABULA_JSON_URL: jsonUrl,
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

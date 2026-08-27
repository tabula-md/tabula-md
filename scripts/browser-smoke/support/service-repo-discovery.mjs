import fs from "node:fs";
import path from "node:path";

export const getSiblingServiceRepoCandidates = ({
  cwd,
  dotGitFile,
  serviceName,
}) => {
  const candidates = [
    path.join(cwd, serviceName),
    path.resolve(cwd, "..", serviceName),
  ];
  const worktreeMatch = dotGitFile?.match(/^gitdir:\s*(.+?)[\\/]\.git[\\/]worktrees[\\/]/m);
  if (worktreeMatch?.[1]) {
    candidates.push(path.join(path.dirname(worktreeMatch[1]), serviceName));
  }
  return [...new Set(candidates)];
};

export const resolveSiblingServiceRepo = ({
  cwd = process.cwd(),
  explicitPath,
  serviceName,
}) => {
  if (explicitPath) return path.resolve(explicitPath);
  const dotGitPath = path.join(cwd, ".git");
  const dotGitFile = fs.existsSync(dotGitPath) && fs.statSync(dotGitPath).isFile()
    ? fs.readFileSync(dotGitPath, "utf8")
    : undefined;
  return getSiblingServiceRepoCandidates({ cwd, dotGitFile, serviceName })
    .find((candidate) => fs.existsSync(path.join(candidate, "package.json")));
};

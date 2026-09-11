export const defaultUpdateRepository = "https://github.com/kungfukoi/Newt_Node.git";
export const defaultUpdateBranch = "main";
export const maxUpdateArchiveBytes = 256 * 1024 * 1024;

export function githubArchiveUrl(repository, branch = defaultUpdateBranch) {
  const coordinates = githubRepositoryCoordinates(repository);
  const cleanBranch = String(branch || "").trim();
  if (!coordinates || !cleanBranch || cleanBranch.length > 240 || /[\0\r\n]/.test(cleanBranch)) return "";

  return `https://codeload.github.com/${encodeURIComponent(coordinates.owner)}/${encodeURIComponent(coordinates.repository)}/zip/refs/heads/${encodeURIComponent(cleanBranch)}`;
}

export function archiveInstallBranchStatus(branch = defaultUpdateBranch) {
  const cleanBranch = String(branch || defaultUpdateBranch).trim() || defaultUpdateBranch;
  return {
    state: "archive-install",
    label: "ZIP install",
    detail: `${cleanBranch} · Ready to update`
  };
}

function githubRepositoryCoordinates(repository) {
  const text = String(repository || "").trim();
  if (!text) return null;

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "github.com") return null;

  let segments;
  try {
    segments = parsed.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  if (segments.length !== 2) return null;

  const owner = segments[0];
  const repositoryName = segments[1].replace(/\.git$/i, "");
  if (!/^[a-z0-9_.-]+$/i.test(owner) || !/^[a-z0-9_.-]+$/i.test(repositoryName)) return null;
  if ([".", ".."].includes(owner) || [".", ".."].includes(repositoryName)) return null;

  return { owner, repository: repositoryName };
}

export function videoReferenceLabel(prompt, title, fallback) {
  const clean = String(title || "").replace(/^@+/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 28);
  const mentions = [...String(prompt || "").matchAll(/@([A-Za-z0-9_-]+)/g)].map(match => match[1].toLowerCase());
  return mentions.includes(clean.toLowerCase()) ? clean : fallback;
}

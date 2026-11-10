import { compactKreaSeedancePrompt } from './kreaSeedance.js';

export function seedanceSubmittedPrompt(prompt, provider, { hasStartFrame = false, hasEndFrame = false } = {}) {
  const original = String(prompt || '').trim();
  const markerText = '\n\nNode reference context:\n';
  const marker = original.indexOf(markerText);
  let creative = original;
  if (marker >= 0) {
    const lines = original.slice(marker + markerText.length).split('\n');
    const diagnostic = line => /^(?:Video|Image|Audio|3D) output:/.test(line) || /^Referenced (?:image|video) node .*:/.test(line);
    const tail = lines.filter((line, index) => !diagnostic(line) && !( /^Referenced node .*:$/.test(line) && diagnostic(lines[index + 1] || '') ));
    creative = [original.slice(0, marker).trimEnd(), tail.join('\n').trim()].filter(Boolean).join('\n\n');
  }
  const frameAliases = { start: hasStartFrame ? 'first frame' : '', end: hasEndFrame ? 'last frame' : '' };
  creative = creative.replace(/(?<![A-Za-z0-9._%+-])@(start|end)(?![A-Za-z0-9_-])/gi,
    (mention, alias) => frameAliases[alias.toLowerCase()] || mention);
  return provider === 'atlas' ? creative : compactKreaSeedancePrompt(creative);
}

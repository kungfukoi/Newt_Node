import { compactKreaSeedancePrompt } from './kreaSeedance.js';

export function seedanceSubmittedPrompt(prompt, provider) {
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
  return provider === 'atlas' ? creative : compactKreaSeedancePrompt(creative);
}

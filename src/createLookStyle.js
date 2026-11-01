export const lookStyleSections = [
  { id: "medium", label: "Medium & rendering", placeholder: "Materials, process and degree of abstraction" },
  { id: "palette", label: "Colour treatment", placeholder: "Palette relationships, saturation and tonal range" },
  { id: "lighting", label: "Light & contrast", placeholder: "Light quality, highlights and shadow behaviour" },
  { id: "texture", label: "Texture & detail", placeholder: "Surface grain, mark making and detail hierarchy" },
  { id: "shape", label: "Shape & edges", placeholder: "Line quality, contours and shape language" },
  { id: "depth", label: "Depth & atmosphere", placeholder: "Spatial treatment, softness and depth cues" },
  { id: "mood", label: "Mood & character", placeholder: "Transferable visual atmosphere and energy" }
];
export const lookStylePriorities=[{value:"absolute",label:"Absolute"},{value:"primary",label:"Primary"},{value:"secondary",label:"Secondary"},{value:"advisory",label:"Advisory"}];
export function lookStyleBlocks(value = {}) {
  return lookStyleSections.map(section => {
    const source = Array.isArray(value) ? value.find(item => item.id === section.id) : { text: value[section.id] };
    const fallback=["medium","palette"].includes(section.id)?"primary":["depth","mood"].includes(section.id)?"advisory":"secondary";
    return { id: section.id, text: typeof source?.text === "string" ? source.text.trim().slice(0,600) : "", enabled: source?.enabled !== false, weight:lookStylePriorities.some(item=>item.value===source?.weight)?source.weight:fallback };
  });
}
export function compileLookStyle(blocks, palette=[]) {
  const active=lookStyleBlocks(blocks).filter(block=>block.enabled&&block.text);
  if(!active.length)return "";
  return active.map(block=>`### ${lookStyleSections.find(section=>section.id===block.id).label} · ${block.weight}\n${block.text}${block.id==="palette"&&palette.length?`\nPalette anchors: ${palette.filter(colour=>/^#[a-f0-9]{6}$/i.test(colour.hex)).slice(0,6).map(colour=>`${colour.name||colour.hex} ${colour.hex}`).join(", ")}`:""}`).join("\n\n");
}

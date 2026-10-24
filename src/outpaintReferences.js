export const outpaintReferenceRoles = [["appearance", "Appearance"], ["environment", "Environment"], ["wardrobe", "Wardrobe"]];

export function normalizeOutpaintReferenceRoles(value) {
  return Array.isArray(value) ? value.slice(0, 30).map(role => outpaintReferenceRoles.some(([id]) => id === role) ? role : "appearance") : [];
}

// Roles follow the existing ordered reference input, including its provider labels.
// References remain graph assets, so the same image nodes can feed many takes.
export function outpaintRoleInstructions(count, roles = []) {
  const normalized = normalizeOutpaintReferenceRoles(roles);
  if (!normalized.some(role => role !== "appearance")) return "";
  const groups = outpaintReferenceRoles.map(([role]) => {
    const labels = Array.from({ length: Math.min(30, count) }, (_, index) => (normalized[index] || "appearance") === role ? `@Image${index + 1}` : "").filter(Boolean);
    if (!labels.length) return "";
    const instruction = role === "environment"
      ? "defines the shared set: preserve its architecture, object layout, floor, materials and lighting in missing regions, adapting perspective to the source camera; exclude reference people"
      : role === "wardrobe"
        ? "defines clothing only: guide unseen garment cut, fabric and pattern on the corresponding source actor; visible source-plate clothing determines hue, saturation, brightness and wash; exclude reference pose and background"
        : "guides appearance and materials only; exclude reference composition";
    return `${labels.join(", ")} ${instruction}.`;
  }).filter(Boolean);
  return ["SHARED OUTPAINT REFERENCES:", ...groups, "Source footage owns framing, camera movement, performance, identity and timing. Preserve visible source colors and geometry; references guide missing content only. Match source lighting and same-frame garment attachments. Never freeze a reference frame or copy its performance."].join("\n");
}

export function assertOutpaintConsistencySupport(body, health) {
  const settings = body.videoOutpaint || body.preparedPlan?.settings || {};
  if ((settings.matchExtensionColor || normalizeOutpaintReferenceRoles(settings.referenceRoles).some(role => role !== "appearance")) && health.routes?.videoOutpaintConsistency !== true) {
    throw new Error("Restart the backend to activate outpaint color matching and reference roles. No generation was submitted.");
  }
}

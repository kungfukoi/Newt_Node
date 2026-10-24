import { fileNameFromLocalUrl } from "./mediaAssets.js";
import { normalizeOutpaintReferenceRoles } from "./outpaintReferences.js";

export const outpaintImagePortIds = ["referenceImageIn", "outpaintImage2In", "outpaintImage3In"];
export const isOutpaintNode = node => node?.type === "utility" && node.data?.utilityMode === "video" && node.data?.utilityVideoModel === "Video Outpaint";

export function outpaintImageSlots(data = {}, urlsByPort = {}, namesByPort = {}) {
  const roles = normalizeOutpaintReferenceRoles(data.videoOutpaint?.referenceRoles);
  return outpaintImagePortIds.map((id, index) => ({ id, index,
    name: String(namesByPort[id] || (urlsByPort[id]?.[0] ? fileNameFromLocalUrl(urlsByPort[id][0]) : `Image ${index + 1}`)),
    role: roles[index] || "appearance", urls: urlsByPort[id] || []
  }));
}

export function outpaintImagePayload(data, urlsByPort) {
  const slots = outpaintImageSlots(data, urlsByPort);
  const legacy = slots[0].urls.length > 3 && slots.slice(1).every(slot => !slot.urls.length);
  const references = slots.flatMap(slot => slot.urls.map((url, index) => ({ url,
    role: legacy ? normalizeOutpaintReferenceRoles(data.videoOutpaint?.referenceRoles)[index] || "appearance" : slot.role
  })));
  return { urls: references.map(ref => ref.url), roles: references.map(ref => ref.role) };
}

// Preserve wire IDs and order when opening old shared-input workflows. Larger
// legacy bundles remain on their original port rather than dropping references.
export function migrateOutpaintImageEdges(nodes, edges) {
  const outpaint = new Set(nodes.filter(isOutpaintNode).map(node => node.id));
  const remap = new Map();
  for (const nodeId of outpaint) {
    const incoming = edges.filter(edge => edge.to.nodeId === nodeId && outpaintImagePortIds.includes(edge.to.port));
    if (incoming.length < 2 || incoming.length > 3 || incoming.some(edge => edge.to.port !== "referenceImageIn")) continue;
    incoming.forEach((edge, index) => remap.set(edge, outpaintImagePortIds[index]));
  }
  return edges.map(edge => remap.has(edge) ? { ...edge, to: { ...edge.to, port: remap.get(edge) } } : edge);
}

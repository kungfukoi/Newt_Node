export const fixtureProjectId = "browser-regression-project";
export function canvasFixture({ count = 271, scale = 0.08, timeline = false, generation = false, attention = false } = {}) {
  const nodes = Array.from({ length: count }, (_, index) => {
    const type = ["plainText", index % 12 === 1 ? "video" : "image", "preview", "style"][index % 4];
    return { id: `fixture-${index}`, type, x: 30 + index % 16 * 480, y: 30 + Math.floor(index / 16) * 650,
      data: { title: `${type} ${index}`, text: "Editable fixture text. Select these words without moving the node.", prompt: "Local fixture prompt", style: "Cinematic", ...(type === "image" || type === "video" ? { resultUrl: `/outputs/e2e/${type === "video" ? "motion.mp4" : "landscape.png"}`, fileName: `${type} fixture`, status: "complete" } : {}) } };
  });
  const edges = nodes.filter((node, index) => index % 4 === 2).map((node, index) => {
    const sourceIndex = index * 4 + 1;
    return { id: `edge-${index}`, from: { nodeId: `fixture-${sourceIndex}`, port: nodes[sourceIndex].type === "video" ? "videoOut" : "imageOut" }, to: { nodeId: node.id, port: "sourceIn" } };
  });
  if (timeline) {
    nodes.splice(0, nodes.length,
      { id: "timeline", type: "assembly", x: 20, y: 20, data: { title: "Timeline", assembly: {
        frameRate: 24, outputWidth: 640, outputHeight: 360, playhead: 0, zoom: 72,
        media: [{ id: "media", type: "video", url: "/outputs/e2e/motion.mp4", label: "Motion", duration: 2, width: 640, height: 360, frameRate: 24 }],
        tracks: [{ id: "v1", type: "video", name: "V1", clips: [{ id: "clip", mediaId: "media", start: 0, duration: 2, sourceIn: 0, sourceDuration: 2 }] }]
      } } },
      { id: "viewer", type: "preview", x: 20, y: 600, data: { title: "Timeline viewer" } });
    edges.splice(0, edges.length, { id: "timeline-viewer", from: { nodeId: "timeline", port: "frameOut" }, to: { nodeId: "viewer", port: "sourceIn" } });
  }
  if (generation) {
    nodes.splice(0, nodes.length,
      { id: "model", type: "imageModel", x: 30, y: 30, data: { title: "Fixture generator", model: "Nano Banana Pro", prompt: "Generate the local test pattern", batchCount: 1, aspectRatio: "16:9", resolution: "1K" } },
      { id: "viewer", type: "preview", x: 550, y: 30, data: { title: "Connected viewer" } });
    edges.splice(0, edges.length, { id: "model-viewer", from: { nodeId: "model", port: "imageOut" }, to: { nodeId: "viewer", port: "sourceIn" } });
  }
  if (attention) {
    nodes.splice(0, nodes.length, { id: "model", type: "videoModel", x: 30, y: 30, data: { title: "Uncertain fixture", model: "Seedance 2.5", prompt: "Local fixture", status: "running" } });
    edges.splice(0, edges.length);
  }
  return { nodes, edges, groups: [], viewport: { x: 20, y: 20, scale }, projectId: fixtureProjectId, projectName: "Browser regression", savedProjectName: "Browser regression", projectPackagePath: "", workflowFilePath: "" };
}

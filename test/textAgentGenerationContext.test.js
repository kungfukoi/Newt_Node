import assert from "node:assert/strict";
import test from "node:test";
import { textAgentGenerationContext } from "../src/textAgentGenerationContext.js";

const edge = (from, to) => ({ from: { nodeId: from }, to: { nodeId: to } });
test("feedback traverses downstream branches with cycles and keeps latest generated media and its prompt", () => {
  const nodes = [
    { id: "agent", type: "textAgent", data: { resultText: "Current prompt" } },
    { id: "image", type: "imageModel", data: { title: "Render", resultUrl: "/old.png", resultItems: [
      { url: "/old.png", type: "image" }, { url: "/new.png", type: "image", prompt: "Original render prompt" }
    ] } },
    { id: "video", type: "videoModel", data: { resultUrl: "/movie.mp4" } },
    { id: "other", type: "imageModel", data: { resultUrl: "/unrelated.png" } },
    { id: "preview", type: "preview", data: { resultUrl: "/new.png", resultType: "image" } },
    { id: "text", type: "textAgent", data: { resultText: "Downstream interpretation" } }
  ];
  const result = textAgentGenerationContext("agent", nodes, [edge("agent", "image"), edge("image", "preview"),
    edge("preview", "video"), edge("video", "agent"), edge("image", "text"), edge("agent", "image")]);
  assert.deepEqual(result.imageInputs.map(item => item.url), ["/new.png"]);
  assert.deepEqual(result.videoInputs.map(item => item.url), ["/movie.mp4"]);
  assert.equal(result.textInputs.length, 3);
  assert.match(result.textInputs[0].text, /Original render prompt/);
  assert.ok(result.textInputs.some(item => item.text.includes("Downstream interpretation")));
  assert.ok(!JSON.stringify(result).includes("unrelated"));
  assert.ok(!JSON.stringify(result).includes("Current prompt"));
});

test("empty and legacy graphs are safe and feedback is bounded", () => {
  assert.deepEqual(textAgentGenerationContext("agent"), { textInputs: [], imageInputs: [], videoInputs: [] });
  const nodes = Array.from({ length: 10 }, (_, i) => ({ id: String(i), type: "imageModel", data: { resultUrl: `/${i}.png` } }));
  const result = textAgentGenerationContext("agent", nodes, nodes.map(node => edge("agent", node.id)));
  assert.equal(result.imageInputs.length, 6);
  assert.equal(result.textInputs.length, 6);
});

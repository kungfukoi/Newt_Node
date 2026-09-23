import assert from "node:assert/strict";
import test from "node:test";
import { nodeApi } from "../src/api/newtApi.js";
import { runSkillDirectorNode } from "../src/nodeRunners/skillDirector.js";

test("Director build sends every connected Reference Setup asset, including the seventh Prop", async () => {
  const previousRun = nodeApi.runSkillDirector;
  let request;
  nodeApi.runSkillDirector = async (body) => {
    request = body;
    return { response: { ok: true }, data: { action: "build", text: "Built Director prompt." } };
  };
  try {
    const propNames = ["can", "frap", "Sign", "book", "koozie", "hat Copy", "goblet"];
    const source = (id, title) => ({ id, data: { title, resultUrl: `/outputs/${id}.png` } });
    const witch = source("witch", "witch");
    const result = await runSkillDirectorNode({
      node: {
        id: "director",
        data: {
          skillDirectorAction: "build",
          sceneOverview: "A still campaign image.",
          skillDurationSeconds: "still",
          lastRunReferenceTags: []
        }
      },
      incoming: {
        characterIn: [{ source: { ...witch, data: { ...witch.data, characterName: "witch", locked: true, activated: true } } }],
        locationIn: [{ source: source("location", "NoiseRedux1") }],
        imageIn: propNames.map((name, index) => ({ source: source(`prop-${index}`, name) }))
      },
      workflowContext: {},
      sourceLabel: (item) => item.data.title
    });

    assert.deepEqual(request.characterInputs.map((item) => item.tag), ["@Witch"]);
    assert.deepEqual(request.locationInputs.map((item) => item.tag), ["@NoiseRedux1"]);
    assert.deepEqual(request.elementInputs.map((item) => item.tag), ["@Can", "@Frap", "@Sign", "@Book", "@Koozie", "@HatCopy", "@Goblet"]);
    assert.equal(result.referenceTags.at(-1), "@Goblet");
  } finally {
    nodeApi.runSkillDirector = previousRun;
  }
});

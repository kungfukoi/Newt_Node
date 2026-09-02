import assert from "node:assert/strict";
import test from "node:test";

import {
  flowNodeNoDragObserverOptions,
  markFlowNodeNoDragElements,
  markFlowNodeNoDragMutations
} from "../src/flowNodeInteractions.js";

function fakeElement({ matches = false, descendants = [] } = {}) {
  const classes = new Set();
  return {
    classes,
    matches() {
      return matches;
    },
    querySelectorAll() {
      return descendants;
    },
    classList: {
      contains(value) {
        return classes.has(value);
      },
      add(value) {
        classes.add(value);
      }
    }
  };
}

test("flow node interaction observer watches dynamic drag attributes", () => {
  assert.equal(flowNodeNoDragObserverOptions.attributes, true);
  assert.ok(flowNodeNoDragObserverOptions.attributeFilter.includes("draggable"));
  assert.equal(flowNodeNoDragObserverOptions.attributeFilter.includes("class"), false);
});

test("a reused element becomes nodrag when its media attributes change", () => {
  const reusedPreview = fakeElement({ matches: true });

  markFlowNodeNoDragMutations([{ type: "attributes", target: reusedPreview }]);

  assert.equal(reusedPreview.classes.has("nodrag"), true);
});

test("a nodrag class mutation does not write the same class again", () => {
  let writes = 0;
  const reusedPreview = fakeElement({ matches: true });
  reusedPreview.classList.add = (value) => {
    writes += 1;
    reusedPreview.classes.add(value);
  };

  markFlowNodeNoDragMutations([{ type: "attributes", target: reusedPreview }]);
  markFlowNodeNoDragMutations([{ type: "attributes", target: reusedPreview }]);

  assert.equal(writes, 1);
});

test("new media descendants receive the nodrag boundary", () => {
  const mediaPreview = fakeElement({ matches: true });
  const wrapper = fakeElement({ descendants: [mediaPreview] });

  markFlowNodeNoDragElements(wrapper);

  assert.equal(mediaPreview.classes.has("nodrag"), true);
});

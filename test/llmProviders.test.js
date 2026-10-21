import test from "node:test";
import assert from "node:assert/strict";

import {
  llmProviderUnavailableMessage,
  normalizeLlmProvider,
  resolveLlmProvider
} from "../src/llmProviders.js";

test("LLM provider resolution follows the preferred enabled provider", () => {
  assert.equal(resolveLlmProvider({ preferredProvider: "fal", falKey: "fal", openAiKey: "openai" }), "fal");
  assert.equal(resolveLlmProvider({ preferredProvider: "OpenAI", openAiKey: "openai", falKey: "fal" }), "openai");
  assert.equal(resolveLlmProvider({ preferredProvider: "Atlas Cloud", atlasKey: "atlas", falKey: "fal" }), "atlas");
});

test("LLM provider resolution falls back at request time when the preferred key is disabled", () => {
  assert.equal(resolveLlmProvider({ preferredProvider: "fal", openAiKey: "openai" }), "openai");
  assert.equal(resolveLlmProvider({ preferredProvider: "google", falKey: "fal", googleKey: "google" }), "fal");
  assert.equal(resolveLlmProvider({ kreaKey: "krea" }), "");
  assert.equal(resolveLlmProvider({ preferredProvider: "krea", kreaKey: "krea", falKey: "fal" }), "krea");
  assert.equal(resolveLlmProvider({ preferredProvider: "atlas", openAiKey: "openai" }), "openai");
});

test("LLM provider names normalize common settings labels", () => {
  assert.equal(normalizeLlmProvider("fal.ai"), "fal");
  assert.equal(normalizeLlmProvider("Gemini"), "");
  assert.equal(normalizeLlmProvider("Krea"), "krea");
  assert.equal(resolveLlmProvider({ preferredProvider: "krea", falKey: "fal" }), "");
  assert.equal(normalizeLlmProvider("Open AI"), "openai");
  assert.equal(normalizeLlmProvider("Atlas Cloud"), "atlas");
});

test("LLM errors include the Krea provider and selected-key action", () => {
  assert.match(llmProviderUnavailableMessage({ kreaKey: "configured" }), /active Fal, OpenAI, Atlas Cloud, or Krea API key/);
  assert.match(llmProviderUnavailableMessage({ kreaKey: "configured" }), /Atlas Cloud/);
});

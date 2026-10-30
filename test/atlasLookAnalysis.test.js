import test from "node:test";
import assert from "node:assert/strict";
import { atlasMediaLlmBody, atlasMediaLlmEndpoint, openAiLlmBody, validateCreativeResponse } from "../server/creative-llm.js";

test("Atlas look analysis follows the model's documented multimodal chat contract without unsupported response parameters", () => {
  const input = [{ role: "user", content: [{ type: "input_image", image_url: "first" }, { type: "input_image", image_url: "second" }] }];
  const options = { model: "openai/gpt-6-astra", route: "look-style-analysis", input, reasoningEffort: "high", responseMimeType: "application/json" };
  const body = atlasMediaLlmBody(options);
  assert.equal(body.text, undefined); assert.equal(body.reasoning, undefined);
  assert.equal(body.model, options.model);
  assert.deepEqual(body.messages[1].content, [{type:"image_url",image_url:{url:"first"}},{type:"image_url",image_url:{url:"second"}}]);
  assert.equal(body.stream, false); assert.equal(body.max_tokens, 8000);
  assert.equal(atlasMediaLlmEndpoint(options.route), "https://api.atlascloud.ai/v1/chat/completions");
  assert.equal(atlasMediaLlmEndpoint("film-director-style"), "https://api.atlascloud.ai/v1/responses");
  assert.equal(openAiLlmBody(options).text.format.type, "json_schema");
  assert.equal(atlasMediaLlmBody({ ...options, route: "film-director-style" }).text.format.type, "json_schema");
  assert.throws(() => validateCreativeResponse({}, { route: options.route, text: '{"stylePrompt":"too short"}' }), /incomplete planning data/);
});

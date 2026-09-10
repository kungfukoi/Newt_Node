import assert from "node:assert/strict";
import test from "node:test";
import { createAtlasClient } from "../server/atlas.js";

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("Atlas submits a generation once and polls the returned job", async () => {
  const calls = [];
  const client = createAtlasClient({
    sleep: async () => {},
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith("/generateImage")) {
        return jsonResponse({ data: { id: "atlas-job-1", status: "pending" } });
      }
      return jsonResponse({
        data: {
          id: "atlas-job-1",
          status: "completed",
          outputs: ["https://cdn.example.com/result.png"]
        }
      });
    }
  });

  const result = await client.generate({
    mediaType: "image",
    input: { model: "openai/gpt-image-2.5-flare/text-to-image", prompt: "Test" },
    key: "atlas-key"
  });

  assert.equal(result.requestId, "atlas-job-1");
  assert.equal(result.url, "https://cdn.example.com/result.png");
  assert.equal(calls.filter(({ options }) => options.method === "POST").length, 1);
  assert.match(calls[1].url, /prediction\/atlas-job-1$/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer atlas-key");
});

test("Atlas does not repeat a paid POST after an uncertain connection failure", async () => {
  let calls = 0;
  const client = createAtlasClient({
    fetchImpl: async () => {
      calls += 1;
      throw new TypeError("socket closed");
    }
  });

  await assert.rejects(
    client.generate({
      mediaType: "video",
      input: { model: "bytedance/seedance-2.5/text-to-video", prompt: "Test" },
      key: "atlas-key"
    }),
    /may have been accepted.*did not resubmit/i
  );
  assert.equal(calls, 1);
});

test("Atlas rejects insecure output URLs", async () => {
  const client = createAtlasClient({
    fetchImpl: async () => jsonResponse({
      data: {
        id: "atlas-job-2",
        status: "completed",
        outputs: ["http://example.com/result.png"]
      }
    })
  });

  await assert.rejects(
    client.generate({
      mediaType: "image",
      input: { model: "openai/gpt-image-2.5-flare/text-to-image", prompt: "Test" },
      key: "atlas-key"
    }),
    /without a usable output/i
  );
});

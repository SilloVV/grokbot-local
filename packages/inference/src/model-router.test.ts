import assert from "node:assert/strict";
import { test } from "node:test";
import { KeepAliveModelRouter, modelForTask } from "./model-router.js";
import type {
  ChatRequest,
  ChatResponse,
  InferenceClient,
  ModelUnloader,
} from "./types.js";

const config = {
  mainModel: "qwen2.5:1.5b",
  routerModel: "qwen2.5:0.5b",
  keepAlive: "30s",
  mainNumCtx: 4096,
};

class FakeClient implements InferenceClient {
  calls: ChatRequest[] = [];
  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.calls.push(request);
    return {
      id: "t",
      model: request.model ?? "unknown",
      message: { role: "assistant", content: `ok:${request.model}` },
    };
  }
}

class FakeUnloader implements ModelUnloader {
  unloaded: string[] = [];
  async unload(model: string): Promise<void> {
    this.unloaded.push(model);
  }
}

test("routing task uses the small model", () => {
  assert.equal(modelForTask("routing", config), "qwen2.5:0.5b");
  assert.equal(modelForTask("conversation", config), "qwen2.5:1.5b");
  assert.equal(modelForTask("tool", config), "qwen2.5:1.5b");
});

test("never keeps both models loaded: unload before switch", async () => {
  const client = new FakeClient();
  const unloader = new FakeUnloader();
  const router = new KeepAliveModelRouter(client, unloader, config);

  await router.route({
    task: "routing",
    messages: [{ role: "user", content: "classify" }],
  });
  assert.equal(router.loadedModel(), "qwen2.5:0.5b");
  assert.deepEqual(unloader.unloaded, []);

  await router.route({
    task: "conversation",
    messages: [{ role: "user", content: "hello" }],
  });
  assert.deepEqual(unloader.unloaded, ["qwen2.5:0.5b"]);
  assert.equal(router.loadedModel(), "qwen2.5:1.5b");
  assert.equal(client.calls[1]?.keep_alive, "30s");
  assert.equal(client.calls[1]?.num_ctx, 4096);
  assert.equal(client.calls[1]?.model, "qwen2.5:1.5b");
});

test("same model does not unload", async () => {
  const client = new FakeClient();
  const unloader = new FakeUnloader();
  const router = new KeepAliveModelRouter(client, unloader, config);
  await router.route({ task: "conversation", messages: [] });
  await router.route({ task: "conversation", messages: [] });
  assert.deepEqual(unloader.unloaded, []);
  assert.equal(router.loadedModel(), "qwen2.5:1.5b");
});

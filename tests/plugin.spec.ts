import { describe, expect, it } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

describe("plugin-clipper", () => {
  it("registers templates data handler", async () => {
    const harness = createTestHarness({ manifest, capabilities: manifest.capabilities });
    await plugin.definition.setup(harness.ctx);

    const data = await harness.getData<{ presets: unknown[]; modules: unknown[]; roles: unknown[] }>("templates");
    // Templates may be empty if templates dir doesn't exist in test env, but handler should respond
    expect(data).toHaveProperty("presets");
    expect(data).toHaveProperty("modules");
    expect(data).toHaveProperty("roles");
  });

  it("registers start-provision action", async () => {
    const harness = createTestHarness({ manifest, capabilities: manifest.capabilities });
    await plugin.definition.setup(harness.ctx);

    // Should fail gracefully without a companyName
    await expect(harness.performAction("start-provision", {})).rejects.toThrow("companyName is required");
  });

  it("reports healthy", async () => {
    const health = await plugin.definition.onHealth!();
    expect(health.status).toBe("ok");
  });
});

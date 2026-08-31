import { createExecutionContext, createScheduledController, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import { getMeta, runDigest } from "../src/digest";
import worker from "../src/index";
import { insertEdit, insertSubmission, testEnv } from "./helpers";

const NOW = new Date("2026-08-29T08:00:00.000Z");

describe("digest", () => {
  it("sends nothing and records nothing when there is no new activity", async () => {
    const env = testEnv();
    const send = vi.fn();
    const result = await runDigest(env, NOW, send);
    expect(result.sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(await getMeta(env.DB, "digest_last_sent")).toBeNull();
  });

  it("composes counts, one line per item, and a review link", async () => {
    const env = testEnv();
    await insertSubmission(
      { v: 2, name: "Wahl Chat", urls: ["https://wahl.chat"], note: "fits" },
      "2026-08-27T10:00:00.000Z",
    );
    await insertEdit("democracy-lab", "2026-08-28T11:00:00.000Z");
    const send = vi.fn();
    const result = await runDigest(env, NOW, send);

    expect(result.sent).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    const [, subject, body] = send.mock.calls[0]!;
    expect(subject).toContain("1 submission(s), 1 edit(s)");
    expect(body).toContain("1 new submission(s), 1 new edit(s)");
    expect(body).toContain("- Wahl Chat — https://wahl.chat — 2026-08-27");
    expect(body).toContain("- democracy-lab — 2026-08-28");
    expect(body).toContain("https://ai4democracy.world/admin");
  });

  it("records digest_last_sent only after a successful send", async () => {
    const env = testEnv();
    await insertSubmission({ v: 2, name: "A", urls: ["https://a.example"], note: "n" });
    await expect(
      runDigest(env, NOW, () => Promise.reject(new Error("smtp down"))),
    ).rejects.toThrow("smtp down");
    expect(await getMeta(env.DB, "digest_last_sent")).toBeNull();

    await runDigest(env, NOW, vi.fn());
    expect(await getMeta(env.DB, "digest_last_sent")).toBe(NOW.toISOString());
  });

  it("only reports rows created after the last digest", async () => {
    const env = testEnv();
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('digest_last_sent', ?1)")
      .bind("2026-08-22T08:00:00.000Z")
      .run();
    await insertSubmission({ v: 2, name: "Old", urls: ["https://old.example"], note: "n" }, "2026-08-21T09:00:00.000Z");
    await insertSubmission({ v: 2, name: "New", urls: ["https://new.example"], note: "n" }, "2026-08-26T09:00:00.000Z");
    const send = vi.fn();
    await runDigest(env, NOW, send);
    const body = send.mock.calls[0]![2] as string;
    expect(body).toContain("New");
    expect(body).not.toContain("Old");
  });

  it("runs from the scheduled handler without touching the email binding when empty", async () => {
    const env = testEnv();
    const ctx = createExecutionContext();
    const controller = createScheduledController({ cron: "0 8 * * 6", scheduledTime: NOW });
    await worker.scheduled(controller, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await getMeta(env.DB, "digest_last_sent")).toBeNull();
  });
});

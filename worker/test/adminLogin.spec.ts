import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { requestLoginLink } from "../src/adminAuth";
import type { SendMail } from "../src/email";
import type { Env } from "../src/types";
import { apiRequest, dispatch, testEnv } from "./helpers";

function mailbox(inbox: string[], fail = false): SendMail {
  return async (_env, _subject, text) => {
    if (fail) throw new Error("unverified destination address");
    inbox.push(text);
  };
}

function linkToken(raw: string): string {
  const match = raw.match(/\/api\/admin\/session\?t=([a-f0-9]+)/);
  if (!match) throw new Error(`no login link in mail: ${raw}`);
  return match[1]!;
}

function requestLink(send: SendMail, ip = "203.0.113.40", envArg: Env = testEnv()): Promise<Response> {
  return requestLoginLink(apiRequest("/api/admin/login", { method: "POST" }, ip), envArg, send);
}

function sessionCookie(res: Response): string {
  const cookie = res.headers.get("Set-Cookie");
  if (!cookie) throw new Error("no Set-Cookie on session response");
  return cookie.split(";")[0]!;
}

describe("admin login by mailed link", () => {
  it("mails a link that opens a session, and burns it on use", async () => {
    const inbox: string[] = [];

    expect((await requestLink(mailbox(inbox))).status).toBe(202);
    expect(inbox).toHaveLength(1);

    const token = linkToken(inbox[0]!);
    const consumed = await dispatch(
      apiRequest(`/api/admin/session?t=${token}`, {}, "203.0.113.41"),
      testEnv(),
    );
    expect(consumed.status).toBe(302);
    expect(consumed.headers.get("location")).toBe("/admin");

    const cookie = sessionCookie(consumed);
    expect(cookie).toMatch(/^admin_session=/);

    const authed = await dispatch(
      apiRequest("/api/admin/submissions", { headers: { Cookie: cookie } }, "203.0.113.42"),
      testEnv(),
    );
    expect(authed.status).toBe(200);

    const replay = await dispatch(
      apiRequest(`/api/admin/session?t=${token}`, {}, "203.0.113.43"),
      testEnv(),
    );
    expect(replay.status).toBe(401);
  });

  it("401s an expired link", async () => {
    const inbox: string[] = [];
    await requestLink(mailbox(inbox), "203.0.113.44");

    await env.DB.prepare("UPDATE admin_logins SET expires_at = ?")
      .bind(new Date(Date.now() - 60_000).toISOString())
      .run();

    const token = linkToken(inbox.at(-1)!);
    const res = await dispatch(
      apiRequest(`/api/admin/session?t=${token}`, {}, "203.0.113.45"),
      testEnv(),
    );
    expect(res.status).toBe(401);
  });

  it("401s an unknown token", async () => {
    const res = await dispatch(
      apiRequest(`/api/admin/session?t=${"a".repeat(64)}`, {}, "203.0.113.46"),
      testEnv(),
    );
    expect(res.status).toBe(401);
  });

  it("reports a delivery failure instead of claiming the mail was sent", async () => {
    const res = await requestLink(mailbox([], true), "203.0.113.47");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ detail: "login_email_failed" });
  });

  it("stops mailing links after 5 requests an hour from one IP", async () => {
    const inbox: string[] = [];
    for (let i = 0; i < 6; i++) await requestLink(mailbox(inbox), "203.0.113.48");
    expect(inbox).toHaveLength(5);
  });
});

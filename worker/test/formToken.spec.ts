import { describe, expect, it } from "vitest";
import { issueToken, tokenReason } from "../src/formToken";

const SECRET = "test-secret";

describe("form token", () => {
  it("accepts a token older than the minimum fill time", async () => {
    const token = await issueToken(SECRET, Date.now() - 10_000);
    expect(await tokenReason(SECRET, token)).toBeNull();
  });

  it("flags a token younger than 3s as too_fast", async () => {
    const token = await issueToken(SECRET);
    expect(await tokenReason(SECRET, token)).toBe("too_fast");
  });

  it("flags a token older than 24h as token_expired", async () => {
    const token = await issueToken(SECRET, Date.now() - 86401_000);
    expect(await tokenReason(SECRET, token)).toBe("token_expired");
  });

  it("flags a tampered signature as token_invalid", async () => {
    const token = await issueToken(SECRET, Date.now() - 10_000);
    const [ts] = token.split(".");
    expect(await tokenReason(SECRET, `${ts}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)).toBe(
      "token_invalid",
    );
  });

  it("flags a token signed with another secret as token_invalid", async () => {
    const token = await issueToken("other-secret", Date.now() - 10_000);
    expect(await tokenReason(SECRET, token)).toBe("token_invalid");
  });

  it("flags missing and malformed tokens as token_invalid", async () => {
    expect(await tokenReason(SECRET, undefined)).toBe("token_invalid");
    expect(await tokenReason(SECRET, "")).toBe("token_invalid");
    expect(await tokenReason(SECRET, "not-a-token")).toBe("token_invalid");
  });
});

import { EmailMessage } from "cloudflare:email";
import type { Env } from "./types";

export type SendMail = (env: Env, subject: string, text: string) => Promise<void>;

export const sendMail: SendMail = async (env, subject, text) => {
  const raw = [
    `From: ${env.DIGEST_FROM}`,
    `To: ${env.DIGEST_TO}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@ai4democracy.world>`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "",
    text,
  ].join("\r\n");
  await env.DIGEST_EMAIL.send(new EmailMessage(env.DIGEST_FROM, env.DIGEST_TO, raw));
};

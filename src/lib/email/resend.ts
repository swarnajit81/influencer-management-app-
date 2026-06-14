import { Resend } from "resend";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cachedClient) cachedClient = new Resend(key);
  return cachedClient;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_api_key" | "no_from_address" | "send_failed"; message?: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getClient();
  if (!client) return { ok: false, reason: "no_api_key" };

  const from = process.env.EMAIL_FROM;
  if (!from) return { ok: false, reason: "no_from_address" };

  const { data, error } = await client.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });

  if (error) return { ok: false, reason: "send_failed", message: error.message };
  if (!data?.id) return { ok: false, reason: "send_failed", message: "no_id_returned" };
  return { ok: true, id: data.id };
}

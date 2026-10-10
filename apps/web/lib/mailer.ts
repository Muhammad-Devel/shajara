export interface Mail { to: string; subject: string; text: string }

/**
 * Email boundary (Resend over plain HTTPS, no SDK needed).
 * - RESEND_API_KEY set  → sends the email.
 * - No key, development → prints the message (with the link) to the server console.
 * - No key, production  → logs a warning; nothing is sent.
 * A delivery failure is logged but never fails the user's request.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[mail:dev] to=${mail.to}\nsubject=${mail.subject}\n${mail.text}\n`);
    } else {
      console.warn("[mail] RESEND_API_KEY is not set; message not sent:", mail.subject);
    }
    return;
  }

  const from = process.env.EMAIL_FROM ?? "SHAJARA <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) console.error("[mail] Resend rejected the message", res.status, await res.text());
  } catch (err) {
    console.error("[mail] failed to reach Resend", err);
  }
}

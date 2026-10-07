export interface Mail { to: string; subject: string; text: string }

/**
 * Email boundary. Phase 4a: development logs the message to the server console; production has NO provider yet,
 * so verification/reset emails are not delivered until a provider (e.g. Resend) is added in Phase 4b.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[mail:dev] to=${mail.to}\nsubject=${mail.subject}\n${mail.text}\n`);
    return;
  }
  console.warn("[mail] no email provider configured; message not sent:", mail.subject);
}

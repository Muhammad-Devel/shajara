"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";

const MESSAGES: Record<string, string> = {
  EMAIL_INVALID: "Email noto‘g‘ri kiritilgan.",
  PASSWORD_TOO_SHORT: "Parol kamida 10 ta belgidan iborat bo‘lsin.",
  PASSWORD_TOO_LONG: "Parol 128 ta belgidan oshmasin.",
  PASSWORD_TOO_COMMON: "Bu parol juda oddiy. Boshqasini tanlang.",
  PASSWORD_INVALID: "Parolni kiriting.",
  NAME_INVALID: "Bu maydon noto‘g‘ri to‘ldirilgan.",
  TOKEN_INVALID: "Havola noto‘g‘ri.",
  INVALID_TOKEN: "Havola noto‘g‘ri yoki muddati o‘tgan.",
  INVALID_CREDENTIALS: "Email yoki parol noto‘g‘ri.",
  EMAIL_TAKEN: "Bu email allaqachon ro‘yxatdan o‘tgan.",
  RATE_LIMITED: "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.",
  VALIDATION_ERROR: "Kiritilgan ma’lumotlarni tekshiring.",
  INTERNAL_ERROR: "Xatolik yuz berdi. Keyinroq urinib ko‘ring.",
};

type Result = { ok: true } | { ok: false; message: string; fields: Record<string, string> };

async function post(path: string, body: unknown): Promise<Result> {
  try {
    const res = await fetch(`/api/v1/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) return { ok: true };
    const code: string = json?.error?.code ?? "INTERNAL_ERROR";
    const fields: Record<string, string> = {};
    const details = json?.error?.details;
    if (details && typeof details === "object") {
      for (const [key, value] of Object.entries(details as Record<string, string>)) fields[key] = MESSAGES[value] ?? MESSAGES.VALIDATION_ERROR ?? "";
    }
    return { ok: false, message: MESSAGES[code] ?? MESSAGES.INTERNAL_ERROR ?? "", fields };
  } catch {
    return { ok: false, message: "Tarmoq xatosi. Internetni tekshiring.", fields: {} };
  }
}

function Shell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="auth-wrap">
      <Link href="/" className="logo">SHAJARA</Link>
      <section className="card auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title">{title}</h1>
        {children}
      </section>
      {footer ? <p className="auth-footer">{footer}</p> : null}
    </main>
  );
}

function Field(props: {
  id: string; label: string; type?: string; autoComplete?: string; error?: string | undefined; hint?: string;
}) {
  const describedBy = props.error ? `${props.id}-error` : props.hint ? `${props.id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id} name={props.id} type={props.type ?? "text"} autoComplete={props.autoComplete}
        required aria-invalid={props.error ? true : undefined} aria-describedby={describedBy}
      />
      {props.error ? <p id={`${props.id}-error`} className="field-error" role="alert">{props.error}</p>
        : props.hint ? <p id={`${props.id}-hint`} className="field-hint">{props.hint}</p> : null}
    </div>
  );
}

function useForm(path: string, onSuccess: () => void) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>, extra?: Record<string, string>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setFields({});
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await post(path, { ...data, ...extra });
    setPending(false);
    if (result.ok) onSuccess();
    else {
      setMessage(result.message);
      setFields(result.fields);
    }
  }
  return { pending, message, fields, submit };
}

const Status = ({ message }: { message: string }) =>
  message ? <p className="form-error" role="alert">{message}</p> : null;

export function LoginForm() {
  const form = useForm("auth/login", () => window.location.assign("/dashboard"));
  return (
    <Shell title="Kirish" footer={<>Akkauntingiz yo‘qmi? <Link href="/register">Ro‘yxatdan o‘ting</Link></>}>
      <form className="form" onSubmit={form.submit} noValidate>
        <Status message={form.message} />
        <Field id="email" label="Email" type="email" autoComplete="email" error={form.fields.email} />
        <Field id="password" label="Parol" type="password" autoComplete="current-password" error={form.fields.password} />
        <button className="btn btn-primary" disabled={form.pending}>{form.pending ? "Kutilmoqda…" : "Kirish"}</button>
        <Link href="/forgot-password" className="auth-link">Parolni unutdingizmi?</Link>
      </form>
    </Shell>
  );
}

export function RegisterForm() {
  const form = useForm("auth/register", () => window.location.assign("/dashboard"));
  return (
    <Shell title="Ro‘yxatdan o‘tish" footer={<>Akkauntingiz bormi? <Link href="/login">Kirish</Link></>}>
      <form className="form" onSubmit={form.submit} noValidate>
        <Status message={form.message} />
        <Field id="firstName" label="Ism" autoComplete="given-name" error={form.fields.firstName} />
        <Field id="lastName" label="Familiya" autoComplete="family-name" error={form.fields.lastName} />
        <Field id="email" label="Email" type="email" autoComplete="email" error={form.fields.email} />
        <Field id="password" label="Parol" type="password" autoComplete="new-password" hint="Kamida 10 ta belgi." error={form.fields.password} />
        <button className="btn btn-primary" disabled={form.pending}>{form.pending ? "Kutilmoqda…" : "Akkaunt yaratish"}</button>
      </form>
    </Shell>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const form = useForm("auth/forgot-password", () => setSent(true));
  return (
    <Shell title="Parolni tiklash" footer={<Link href="/login">Kirish sahifasiga qaytish</Link>}>
      {sent ? (
        <p role="status">Agar bu email ro‘yxatdan o‘tgan bo‘lsa, parolni tiklash havolasi yuborildi.</p>
      ) : (
        <form className="form" onSubmit={form.submit} noValidate>
          <Status message={form.message} />
          <Field id="email" label="Email" type="email" autoComplete="email" error={form.fields.email} />
          <button className="btn btn-primary" disabled={form.pending}>{form.pending ? "Kutilmoqda…" : "Havola yuborish"}</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const form = useForm("auth/reset-password", () => setDone(true));
  return (
    <Shell title="Yangi parol">
      {done ? (
        <p role="status">Parol yangilandi. <Link href="/login">Kirish</Link></p>
      ) : (
        <form className="form" onSubmit={(e) => form.submit(e, { token })} noValidate>
          <Status message={form.message} />
          <Field id="password" label="Yangi parol" type="password" autoComplete="new-password" hint="Kamida 10 ta belgi." error={form.fields.password} />
          <button className="btn btn-primary" disabled={form.pending}>{form.pending ? "Kutilmoqda…" : "Parolni saqlash"}</button>
        </form>
      )}
    </Shell>
  );
}

export function VerifyEmailCard({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  async function verify() {
    setState("loading");
    const result = await post("auth/verify-email", { token });
    setState(result.ok ? "done" : "error");
  }
  return (
    <Shell title="Emailni tasdiqlash">
      {state === "done" ? (
        <p role="status">Email tasdiqlandi. <Link href="/dashboard">Davom etish</Link></p>
      ) : (
        <div className="form">
          {state === "error" ? <p className="form-error" role="alert">Havola noto‘g‘ri yoki muddati o‘tgan.</p> : null}
          <button className="btn btn-primary" onClick={verify} disabled={state === "loading" || !token}>
            {state === "loading" ? "Kutilmoqda…" : "Emailni tasdiqlash"}
          </button>
        </div>
      )}
    </Shell>
  );
}

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    await post("auth/logout", {});
    window.location.assign("/");
  }
  return <button className="btn btn-secondary" onClick={logout} disabled={pending}>Chiqish</button>;
}

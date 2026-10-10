"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/components/api-client";
import { ROLE_LABEL } from "@/lib/labels";

type Role = keyof typeof ROLE_LABEL;

export function InviteForm({
  familyId, grantableRoles, people,
}: { familyId: string; grantableRoles: Role[]; people: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true); setMessage(""); setFields({}); setLink(""); setCopied(false);
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(Object.fromEntries(new FormData(form).entries()) as Record<string, string>)) {
      if (v.trim() !== "") body[k] = v.trim();
    }
    const res = await api("POST", `families/${familyId}/invitations`, body);
    setPending(false);
    if (!res.ok) { setMessage(res.message); setFields(res.fields); return; }
    setLink(res.data.link as string);
    form.reset();
    router.refresh();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <form className="form" onSubmit={submit} noValidate>
        {message ? <p className="form-error" role="alert">{message}</p> : null}
        <div className="grid2">
          <div className="field">
            <label htmlFor="role">Rol</label>
            <select id="role" name="role" defaultValue="VIEWER">
              {grantableRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            {fields.role ? <p className="field-error" role="alert">{fields.role}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="personId">Shajaradagi qaysi odam uchun (ixtiyoriy)</label>
            <select id="personId" name="personId" defaultValue="">
              <option value="">— Tanlanmagan —</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p className="field-hint">Tanlansa, qabul qilganda akkaunt shu odam kartasiga bog‘lanadi.</p>
          </div>
        </div>
        <div className="field">
          <label htmlFor="email">Email (ixtiyoriy)</label>
          <input id="email" name="email" type="email" autoComplete="off" />
          <p className="field-hint">Email kiritilsa, taklif faqat shu manzil egasi uchun ishlaydi va xat yuboriladi.</p>
          {fields.email ? <p className="field-error" role="alert">{fields.email}</p> : null}
        </div>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Kutilmoqda…" : "Taklif havolasini yaratish"}</button>
      </form>

      {link ? (
        <div className="notice invite-result" role="status">
          <p><strong>Havola tayyor.</strong> U faqat hozir ko‘rsatiladi, nusxa oling:</p>
          <input readOnly value={link} aria-label="Taklif havolasi" onFocus={(e) => e.currentTarget.select()} />
          <div className="invite-actions">
            <button type="button" className="btn btn-secondary" onClick={copy}>{copied ? "Nusxalandi ✓" : "Nusxalash"}</button>
            <a className="btn btn-secondary" target="_blank" rel="noopener noreferrer"
              href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("SHAJARA oilamizga qo‘shiling")}`}>
              Telegramda yuborish
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RoleSelect({ familyId, userId, current, options }: { familyId: string; userId: string; current: Role; options: Role[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function change(role: string) {
    setPending(true); setError("");
    const res = await api("PATCH", `families/${familyId}/members/${userId}`, { role });
    setPending(false);
    if (!res.ok) { setError(res.message); return; }
    router.refresh();
  }
  return (
    <span>
      <select aria-label="Rolni o‘zgartirish" value={current} disabled={pending} onChange={(e) => change(e.target.value)}>
        {[...new Set<Role>([current, ...options])].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
      {error ? <span className="field-error" role="alert"> {error}</span> : null}
    </span>
  );
}

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function accept() {
    setPending(true); setMessage("");
    const res = await api("POST", `invite/${token}/accept`);
    setPending(false);
    if (!res.ok) { setMessage(res.message); return; }
    router.push(`/families/${res.data.familyId as string}/tree`);
  }
  return (
    <div className="form">
      {message ? <p className="form-error" role="alert">{message}</p> : null}
      <button className="btn btn-primary" onClick={accept} disabled={pending}>{pending ? "Kutilmoqda…" : "Qabul qilish"}</button>
    </div>
  );
}

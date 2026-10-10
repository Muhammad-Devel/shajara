"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/components/api-client";

function useAction() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  return { pending, setPending, message, setMessage, fields, setFields };
}

function Row({ id, label, error, hint, children }: { id: string; label: string; error?: string | undefined; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

const Status = ({ message }: { message: string }) => (message ? <p className="form-error" role="alert">{message}</p> : null);

export function CreateFamilyForm() {
  const router = useRouter();
  const a = useAction();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    a.setPending(true); a.setMessage(""); a.setFields({});
    const data = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    const res = await api("POST", "families", { name: data.name, description: data.description });
    a.setPending(false);
    if (!res.ok) { a.setMessage(res.message); a.setFields(res.fields); return; }
    const family = res.data.family as { id: string };
    router.push(`/families/${family.id}`);
  }
  return (
    <form className="form" onSubmit={submit} noValidate>
      <Status message={a.message} />
      <Row id="name" label="Oila nomi" error={a.fields.name}>
        <input id="name" name="name" required placeholder="Masalan: Karimovlar oilasi" />
      </Row>
      <Row id="description" label="Qisqa tavsif (ixtiyoriy)" error={a.fields.description}>
        <input id="description" name="description" />
      </Row>
      <button className="btn btn-primary" disabled={a.pending}>{a.pending ? "Kutilmoqda…" : "Oila yaratish"}</button>
    </form>
  );
}

const GENDERS: [string, string][] = [["", "Ko‘rsatilmagan"], ["MALE", "Erkak"], ["FEMALE", "Ayol"], ["OTHER", "Boshqa"]];
const VISIBILITIES: [string, string][] = [
  ["", "Avtomatik (tirik: faqat men va adminlar, vafot etgan: butun oila)"],
  ["FAMILY", "Butun oila ko‘radi"],
  ["PRIVATE", "Faqat men va adminlar"],
];

export function AddPersonForm({ familyId }: { familyId: string }) {
  const router = useRouter();
  const a = useAction();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    a.setPending(true); a.setMessage(""); a.setFields({});
    const body: Record<string, string> = { familyId };
    for (const [k, v] of Object.entries(Object.fromEntries(new FormData(form).entries()) as Record<string, string>)) {
      if (v.trim() !== "") body[k] = v.trim();
    }
    const res = await api("POST", "persons", body);
    a.setPending(false);
    if (!res.ok) { a.setMessage(res.message); a.setFields(res.fields); return; }
    form.reset();
    router.refresh();
  }
  return (
    <form className="form" onSubmit={submit} noValidate>
      <Status message={a.message} />
      <div className="grid2">
        <Row id="firstName" label="Ism" error={a.fields.firstName}><input id="firstName" name="firstName" required /></Row>
        <Row id="lastName" label="Familiya" error={a.fields.lastName}><input id="lastName" name="lastName" /></Row>
        <Row id="gender" label="Jins" error={a.fields.gender}>
          <select id="gender" name="gender">{GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Row>
        <Row id="birthDate" label="Tug‘ilgan sana" hint="YYYY yoki YYYY-OO-KK" error={a.fields.birthDate}><input id="birthDate" name="birthDate" placeholder="1950" /></Row>
        <Row id="deathDate" label="Vafot sanasi" hint="Bo‘sh = tirik" error={a.fields.deathDate ?? a.fields.isLiving}><input id="deathDate" name="deathDate" /></Row>
        <Row id="visibility" label="Kim ko‘radi" error={a.fields.visibility}>
          <select id="visibility" name="visibility">{VISIBILITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Row>
      </div>
      <button className="btn btn-primary" disabled={a.pending}>{a.pending ? "Kutilmoqda…" : "Odam qo‘shish"}</button>
    </form>
  );
}

export function AddRelationForm({ people }: { people: { id: string; name: string }[] }) {
  const router = useRouter();
  const a = useAction();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    a.setPending(true); a.setMessage("");
    const d = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const res =
      d.kind === "parent"
        ? await api("POST", "parent-child", { parentId: d.first, childId: d.second })
        : await api("POST", "marriages", { personAId: d.first, personBId: d.second });
    a.setPending(false);
    if (!res.ok) { a.setMessage(res.message); return; }
    form.reset();
    router.refresh();
  }
  const options = people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>);
  return (
    <form className="form" onSubmit={submit} noValidate>
      <Status message={a.message} />
      <div className="grid2">
        <Row id="first" label="Birinchi odam"><select id="first" name="first" required>{options}</select></Row>
        <Row id="kind" label="Bog‘lanish turi">
          <select id="kind" name="kind">
            <option value="parent">Birinchi — ikkinchining ota-onasi</option>
            <option value="spouse">Turmush o‘rtoqlar</option>
          </select>
        </Row>
        <Row id="second" label="Ikkinchi odam"><select id="second" name="second" required>{options}</select></Row>
      </div>
      <button className="btn btn-primary" disabled={a.pending}>{a.pending ? "Kutilmoqda…" : "Bog‘lash"}</button>
    </form>
  );
}

export function DeleteButton({ path, confirmText, label = "O‘chirish" }: { path: string; confirmText: string; label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (!window.confirm(confirmText)) return;
    setPending(true); setError("");
    const res = await api("DELETE", path);
    setPending(false);
    if (!res.ok) { setError(res.message); return; }
    router.refresh();
  }
  return (
    <span>
      <button type="button" className="btn btn-ghost btn-small" onClick={remove} disabled={pending}>{label}</button>
      {error ? <span className="field-error" role="alert"> {error}</span> : null}
    </span>
  );
}

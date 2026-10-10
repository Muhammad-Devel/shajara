/** Browser-side helper for the JSON API. Maps error codes to Uzbek messages. */

export const MESSAGES: Record<string, string> = {
  NAME_INVALID: "Nom noto‘g‘ri yoki juda uzun.",
  DESCRIPTION_TOO_LONG: "Tavsif juda uzun.",
  BIO_TOO_LONG: "Matn juda uzun.",
  DATE_INVALID: "Sana noto‘g‘ri. Format: YYYY, YYYY-OO yoki YYYY-OO-KK.",
  DEATH_BEFORE_BIRTH: "Vafot sanasi tug‘ilgan sanadan oldin bo‘lishi mumkin emas.",
  LIVING_WITH_DEATH_DATE: "Vafot sanasi bor, lekin tirik deb belgilangan.",
  GENDER_INVALID: "Jins noto‘g‘ri.",
  VISIBILITY_INVALID: "Ko‘rinish darajasi noto‘g‘ri.",
  ID_INVALID: "Tanlov noto‘g‘ri.",
  FORBIDDEN: "Sizda bunga ruxsat yo‘q.",
  FAMILY_NOT_FOUND: "Oila topilmadi.",
  PERSON_NOT_FOUND: "Odam topilmadi.",
  RELATION_NOT_FOUND: "Bog‘lanish topilmadi.",
  FAMILY_LIMIT: "Oilalar soni chegarasiga yetdingiz.",
  PERSON_LIMIT: "Oiladagi odamlar soni chegarasiga yetildi.",
  DUPLICATE_RELATIONSHIP: "Bu bog‘lanish allaqachon mavjud.",
  CYCLE_DETECTED: "Bu halqa hosil qiladi: farzand allaqachon ota-onaning ajdodi.",
  SELF_PARENT: "Odam o‘zining ota-onasi bo‘la olmaydi.",
  SELF_MARRIAGE: "Odam o‘zi bilan turmush qura olmaydi.",
  PARENT_YOUNGER_THAN_CHILD: "Ota-ona farzanddan oldin tug‘ilgan bo‘lishi kerak.",
  PARENT_DIED_BEFORE_CHILD_CONCEIVED: "Ota-ona farzand tug‘ilishidan ancha oldin vafot etgan.",
  MARRIAGE_IN_DIRECT_LINE: "Ajdod va avlod o‘rtasida nikoh bo‘lishi mumkin emas.",
  TOO_MANY_PARENTS: "Biologik ota-ona ikkitadan ko‘p bo‘lmaydi.",
  DIFFERENT_FAMILIES: "Bu odamlar turli oilalarga tegishli.",
  CANNOT_DELETE_ACCOUNT_PERSON: "Akkauntga bog‘langan odamni o‘chirib bo‘lmaydi.",
  ROLE_INVALID: "Rol noto‘g‘ri.",
  EMAIL_INVALID: "Email noto‘g‘ri kiritilgan.",
  ADMIN_REQUIRES_EMAIL: "Admin taklifi faqat email orqali yuboriladi. Email kiriting.",
  INVITE_LIMIT: "Kutilayotgan takliflar soni chegarasiga yetdingiz.",
  INVITE_INVALID: "Taklif yaroqsiz yoki muddati o‘tgan.",
  INVITE_NOT_FOUND: "Taklif topilmadi.",
  INVITE_EMAIL_MISMATCH: "Bu taklif boshqa email manziliga yuborilgan. O‘sha email bilan kiring.",
  INVITE_EMAIL_UNVERIFIED: "Avval emailingizni tasdiqlang (dashboardda), keyin qaytib keling.",
  ALREADY_MEMBER: "Siz allaqachon bu oila a’zosisiz.",
  MEMBER_LIMIT: "Oilada a’zolar soni chegarasiga yetildi.",
  MEMBER_NOT_FOUND: "A’zo topilmadi.",
  CANNOT_CHANGE_SELF: "O‘z rolingizni o‘zgartira olmaysiz.",
  PERSON_HAS_ACCOUNT: "Bu odam allaqachon akkauntga bog‘langan.",
  CONFLICT: "Bir vaqtda o‘zgarish bo‘ldi. Qayta urinib ko‘ring.",
  RATE_LIMITED: "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.",
  UNAUTHENTICATED: "Qaytadan kiring.",
  VALIDATION_ERROR: "Kiritilgan ma’lumotlarni tekshiring.",
  INTERNAL_ERROR: "Xatolik yuz berdi. Keyinroq urinib ko‘ring.",
};

export type ApiResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; message: string; fields: Record<string, string> };

export async function api(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(`/api/v1/${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) return { ok: true, data: (json.data ?? {}) as Record<string, unknown> };
    const code: string = json?.error?.code ?? "INTERNAL_ERROR";
    const fields: Record<string, string> = {};
    const details = json?.error?.details;
    if (details && typeof details === "object") {
      for (const [k, v] of Object.entries(details as Record<string, string>)) fields[k] = MESSAGES[v] ?? MESSAGES.VALIDATION_ERROR ?? "";
    }
    return { ok: false, message: MESSAGES[code] ?? MESSAGES.INTERNAL_ERROR ?? "", fields };
  } catch {
    return { ok: false, message: "Tarmoq xatosi. Internetni tekshiring.", fields: {} };
  }
}

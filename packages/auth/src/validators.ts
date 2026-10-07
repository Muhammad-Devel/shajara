export type FieldErrors = Record<string, string>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
const NAME_MAX = 80;
const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "1234567890", "12345678910", "0123456789",
  "qwertyuiop", "qwerty12345", "1q2w3e4r5t", "iloveyou12", "parolparol", "adminadmin", "letmein123",
  "welcome123", "abc1234567", "1111111111", "0000000000",
]);

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type PasswordProblem = "PASSWORD_TOO_SHORT" | "PASSWORD_TOO_LONG" | "PASSWORD_TOO_COMMON";

export function checkPassword(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN) return "PASSWORD_TOO_SHORT";
  if (password.length > PASSWORD_MAX) return "PASSWORD_TOO_LONG";
  if (COMMON_PASSWORDS.has(password.toLowerCase()) || new Set(password).size <= 2) return "PASSWORD_TOO_COMMON";
  return null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function emailField(obj: Record<string, unknown>, errors: FieldErrors): string {
  const email = normalizeEmail(str(obj.email));
  if (!email || email.length > EMAIL_MAX || !EMAIL_RE.test(email)) errors.email = "EMAIL_INVALID";
  return email;
}

function passwordField(obj: Record<string, unknown>, errors: FieldErrors): string {
  const password = str(obj.password);
  const problem = checkPassword(password);
  if (problem) errors.password = problem;
  return password;
}

function nameField(obj: Record<string, unknown>, key: "firstName" | "lastName", errors: FieldErrors): string {
  const value = str(obj[key]).trim().replace(/\s+/g, " ");
  if (value.length < 1 || value.length > NAME_MAX) errors[key] = "NAME_INVALID";
  return value;
}

function result<T>(errors: FieldErrors, value: T): Parsed<T> {
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

const BAD_BODY: Parsed<never> = { ok: false, errors: { _: "BODY_INVALID" } };

export interface RegisterInput { email: string; password: string; firstName: string; lastName: string }
export function parseRegister(input: unknown): Parsed<RegisterInput> {
  if (!isObject(input)) return BAD_BODY;
  const errors: FieldErrors = {};
  const value = {
    email: emailField(input, errors),
    password: passwordField(input, errors),
    firstName: nameField(input, "firstName", errors),
    lastName: nameField(input, "lastName", errors),
  };
  return result(errors, value);
}

/** Login does not apply the password policy: it only checks that something was sent. */
export function parseLogin(input: unknown): Parsed<{ email: string; password: string }> {
  if (!isObject(input)) return BAD_BODY;
  const errors: FieldErrors = {};
  const email = emailField(input, errors);
  const password = str(input.password);
  if (!password || password.length > PASSWORD_MAX) errors.password = "PASSWORD_INVALID";
  return result(errors, { email, password });
}

export function parseEmailOnly(input: unknown): Parsed<{ email: string }> {
  if (!isObject(input)) return BAD_BODY;
  const errors: FieldErrors = {};
  return result(errors, { email: emailField(input, errors) });
}

export function parseToken(input: unknown): Parsed<{ token: string }> {
  if (!isObject(input)) return BAD_BODY;
  const token = str(input.token);
  if (token.length < 20 || token.length > 200) return { ok: false, errors: { token: "TOKEN_INVALID" } };
  return { ok: true, value: { token } };
}

export function parseResetPassword(input: unknown): Parsed<{ token: string; password: string }> {
  if (!isObject(input)) return BAD_BODY;
  const errors: FieldErrors = {};
  const token = str(input.token);
  if (token.length < 20 || token.length > 200) errors.token = "TOKEN_INVALID";
  const password = passwordField(input, errors);
  return result(errors, { token, password });
}

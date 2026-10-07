import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Parolni tiklash", robots: { index: false } };

export default function Page() {
  return <ForgotPasswordForm />;
}

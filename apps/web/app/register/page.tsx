import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Ro‘yxatdan o‘tish", robots: { index: false } };

export default function Page() {
  return <RegisterForm />;
}

import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Kirish", robots: { index: false } };

export default function Page() {
  return <LoginForm />;
}

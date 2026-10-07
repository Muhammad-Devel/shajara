import type { Metadata } from "next";
import { VerifyEmailCard } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Emailni tasdiqlash", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <VerifyEmailCard token={token ?? ""} />;
}

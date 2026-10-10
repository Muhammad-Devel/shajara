import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Ro‘yxatdan o‘tish", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <RegisterForm next={next} />;
}

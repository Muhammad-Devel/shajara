import { handle, ok } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { publicUser } from "@/lib/user-dto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handle(async () => {
  const { user } = await requireSession();
  return ok({ user: publicUser(user) });
});

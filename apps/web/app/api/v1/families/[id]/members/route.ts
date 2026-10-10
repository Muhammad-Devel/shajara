import { can } from "@shajara/access";
import { prisma } from "@shajara/database";
import { handle, ok } from "@/lib/api";
import { requireMembership } from "@/lib/families";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Every member can see who is in the family; emails are visible to admins and the owner only. */
export const GET = handle<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { user } = await requireSession();
  const { role } = await requireMembership(user.id, id);
  const showEmail = can(role, "member:manage");

  const members = await prisma.familyMember.findMany({
    where: { familyId: id },
    include: { user: { include: { profile: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return ok({
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      isYou: m.userId === user.id,
      firstName: m.user.profile?.firstName ?? null,
      lastName: m.user.profile?.lastName ?? null,
      ...(showEmail ? { email: m.user.email } : {}),
    })),
  });
});

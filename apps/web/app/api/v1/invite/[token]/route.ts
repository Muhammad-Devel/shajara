import { ApiError, clientIp, enforceRateLimit, handle, ok } from "@/lib/api";
import { findUsableInvitation, invitedPerson } from "@/lib/invitations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/** Public preview for someone who holds the link. Reveals only what the invitee needs to decide. */
export const GET = handle<Ctx>(async (req, { params }) => {
  const { token } = await params;
  await enforceRateLimit(`invite-preview:${clientIp(req)}`, 60, 3_600_000);
  const inv = await findUsableInvitation(token);
  if (!inv) throw new ApiError(404, "INVITE_INVALID", "The invitation is invalid or has expired");
  const person = await invitedPerson(inv);
  return ok({
    family: { name: inv.family.name },
    role: inv.role,
    invitedBy: inv.invitedBy.profile?.firstName ?? null,
    person: person ? { firstName: person.firstName, lastName: person.lastName } : null,
    emailBound: inv.email !== null,
  });
});

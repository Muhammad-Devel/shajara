import { Prisma, prisma } from "@shajara/database";

/** Append-only audit trail. Never put passwords, tokens or other secrets in `meta`. */
export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        meta: entry.meta ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log", err); // auditing must not break the request
  }
}

import { and, eq, exists, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { engagementMembers, engagements } from "@/db/schema";
import { canSeeAllEngagements, hasPermission, type Role } from "./matrix";

export type AccessActor = {
  organisationId: string;
  userId?: string;
  role?: string | null;
  serviceAccountId?: string | null;
};

export class EngagementAccessError extends Error {
  constructor() {
    super("The requested engagement was not found");
    this.name = "EngagementAccessError";
  }
}

export function engagementVisibility(
  actor: AccessActor,
  engagementIdColumn: AnyPgColumn,
): SQL | undefined {
  if (canSeeAllEngagements(actor)) return undefined;
  if (!actor.userId) return sql`false`;
  return exists(
    db
      .select({ id: engagementMembers.id })
      .from(engagementMembers)
      .where(
        and(
          eq(engagementMembers.engagementId, engagementIdColumn),
          eq(engagementMembers.organisationId, actor.organisationId),
          eq(engagementMembers.userId, actor.userId),
          isNull(engagementMembers.deletedAt),
        ),
      ),
  );
}

export function withEngagementAccess(
  actor: AccessActor,
  engagementIdColumn: AnyPgColumn,
  ...conditions: Array<SQL | undefined>
) {
  return and(...conditions, engagementVisibility(actor, engagementIdColumn));
}

export function canListAllClients(actor: AccessActor) {
  if (canSeeAllEngagements(actor)) return true;
  if (!actor.role) return false;
  return (
    hasPermission(actor.role as Role, "client:manage") ||
    hasPermission(actor.role as Role, "engagement:create")
  );
}

export function clientVisibility(
  actor: AccessActor,
  clientIdColumn: AnyPgColumn,
): SQL | undefined {
  const identified = Boolean(
    actor.userId || actor.role || actor.serviceAccountId,
  );
  if (!identified) return undefined;
  if (canListAllClients(actor)) return undefined;
  if (!actor.userId) return sql`false`;
  return exists(
    db
      .select({ id: engagementMembers.id })
      .from(engagementMembers)
      .innerJoin(
        engagements,
        and(
          eq(engagements.id, engagementMembers.engagementId),
          eq(engagements.organisationId, engagementMembers.organisationId),
          eq(engagements.clientId, clientIdColumn),
        ),
      )
      .where(
        and(
          eq(engagementMembers.organisationId, actor.organisationId),
          eq(engagementMembers.userId, actor.userId),
          isNull(engagementMembers.deletedAt),
          isNull(engagements.deletedAt),
        ),
      ),
  );
}

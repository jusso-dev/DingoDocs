import { and, eq, exists, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { engagementMembers } from "@/db/schema";
import { canSeeAllEngagements } from "./matrix";

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

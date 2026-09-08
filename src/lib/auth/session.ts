import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "./auth";

export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  if (await isUserInactive(session.user.id)) return null;
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new AuthenticationRequiredError();
  return session;
}

export async function requirePageSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

async function isUserInactive(userId: string) {
  const [user] = await db
    .select({
      banned: users.banned,
      banExpires: users.banExpires,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return true;
  if (user.disabledAt) return true;
  if (!user.banned) return false;
  return !user.banExpires || user.banExpires.getTime() > Date.now();
}

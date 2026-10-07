import type { Profile, User } from "@shajara/database";

/** The ONLY shape of a user that leaves the server. Never spread a Prisma User into a response. */
export function publicUser(user: User & { profile: Profile | null }) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified !== null,
    role: user.role,
    locale: user.locale,
    profile: user.profile ? { firstName: user.profile.firstName, lastName: user.profile.lastName } : null,
  };
}

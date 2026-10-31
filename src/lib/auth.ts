import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticate } from "@/features/auth/login";
import { credentialsSchema } from "@/features/auth/schema";
import { SESSION_MAX_AGE_MS } from "@/features/auth/session-check";
import { getDb } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_MS / 1000 },
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const result = await authenticate(getDb(), parsed.data);
        return result.ok ? result.user : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present at sign-in; stamp the token so it can be revoked and expired absolutely.
      if (user?.id) {
        token.sub = user.id;
        token.sv = user.sessionVersion;
        token.loginAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.sessionVersion = token.sv;
      session.loginAt = token.loginAt;
      return session;
    },
  },
});

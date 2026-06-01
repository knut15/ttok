// Session/JWT 타입 보강 — scope 클레임(role/storeId/membershipId/operationalId/isManager).
import type { DefaultSession } from "next-auth";
import type { Role } from "@/types";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    role: Role | null;
    storeId: string | null;
    membershipId: string | null;
    operationalId: string | null;
    isManager: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role | null;
    storeId?: string | null;
    membershipId?: string | null;
    operationalId?: string | null;
    isManager?: boolean;
  }
}

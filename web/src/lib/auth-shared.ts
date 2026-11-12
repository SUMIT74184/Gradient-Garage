/** Auth types and role checks that are safe to use in client components. */
export type Role = "owner" | "editor" | "viewer" | "member";
export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  avatarUrl: string | null;
  hasPassword: boolean;
  providers: string[];
  lastLoginAt: string | null;
  createdAt: string | null;
  sessions?: number;
  emailVerified: boolean;
  isTeam: boolean;
};

const RANK: Record<Role, number> = { member: -1, viewer: 0, editor: 1, owner: 2 };
export const can = (user: Pick<AdminUser, "role"> | null | undefined, need: Role) => !!user && RANK[user.role] >= RANK[need];


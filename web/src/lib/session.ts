/**
 * Who is calling. Two flavours: pages redirect to /login, API routes throw.
 *
 * Roles are enforced here, server-side, on every request (US-P1-01, F1-03):
 * hiding a link is never the control.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, type Role } from "./auth";
import { errors } from "./api";

export type Viewer = {
  id: string;
  name: string;
  username: string;
  role: Role;
};

async function current(): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as { id: string; name: string; username?: string | null; role?: string | null; banned?: boolean | null };
  if (u.banned) return null;
  return {
    id: u.id,
    name: u.name,
    username: u.username ?? u.name,
    role: (u.role as Role) ?? "participant",
  };
}

/** For pages: the signed-in viewer, or a redirect to /login. */
export async function requireViewer(...roles: Role[]): Promise<Viewer> {
  const viewer = await current();
  if (!viewer) redirect("/login");
  if (roles.length && !roles.includes(viewer.role)) redirect(homeFor(viewer.role));
  return viewer;
}

/** For API routes: the signed-in viewer, or a 401 / 403. */
export async function requireApiViewer(...roles: Role[]): Promise<Viewer> {
  const viewer = await current();
  if (!viewer) throw errors.unauthorized();
  if (roles.length && !roles.includes(viewer.role)) throw errors.forbidden();
  return viewer;
}

export async function optionalViewer(): Promise<Viewer | null> {
  return current();
}

export function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "evaluator") return "/grade";
  return "/dashboard";
}

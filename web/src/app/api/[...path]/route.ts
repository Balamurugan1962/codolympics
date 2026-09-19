/**
 * Every /api request except sign-in and sign-out goes to the contest engine.
 *
 * Better Auth keeps /api/auth/* (a more specific route, so it wins). All
 * contest behaviour -- and the check of who is calling -- happens in the engine.
 */
import { forward } from "@/lib/engine";

export const dynamic = "force-dynamic";

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };

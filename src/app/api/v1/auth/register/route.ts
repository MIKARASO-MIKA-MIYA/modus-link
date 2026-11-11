export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { registerPost as POST, methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE } from "@/server/handlers";
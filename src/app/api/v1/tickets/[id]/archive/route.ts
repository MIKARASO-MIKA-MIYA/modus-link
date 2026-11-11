export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  archivePost as POST,
  methodNotAllowed as GET,
  methodNotAllowed as PATCH,
  methodNotAllowed as PUT,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

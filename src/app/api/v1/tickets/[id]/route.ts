export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  ticketGet as GET,
  ticketPatch as PATCH,
  methodNotAllowed as POST,
  methodNotAllowed as PUT,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

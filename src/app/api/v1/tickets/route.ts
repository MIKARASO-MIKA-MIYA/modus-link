export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  ticketsGet as GET,
  ticketsPost as POST,
  methodNotAllowed as PATCH,
  methodNotAllowed as PUT,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  meGet as GET,
  methodNotAllowed as POST,
  methodNotAllowed as PATCH,
  methodNotAllowed as PUT,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

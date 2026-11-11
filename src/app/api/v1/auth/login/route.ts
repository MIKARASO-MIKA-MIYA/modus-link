export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  loginPost as POST,
  methodNotAllowed as GET,
  methodNotAllowed as PATCH,
  methodNotAllowed as PUT,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

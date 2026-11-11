export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  departmentsGet as GET,
  departmentsPost as POST,
  methodNotAllowed as PATCH,
  methodNotAllowed as PUT,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

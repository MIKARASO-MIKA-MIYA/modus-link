export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  departmentPatch as PATCH,
  methodNotAllowed as GET,
  methodNotAllowed as POST,
  methodNotAllowed as PUT,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

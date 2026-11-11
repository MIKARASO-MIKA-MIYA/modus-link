export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  categoriesGet as GET,
  categoriesPost as POST,
  methodNotAllowed as PATCH,
  methodNotAllowed as PUT,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

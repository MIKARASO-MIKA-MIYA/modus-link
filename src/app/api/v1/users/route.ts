export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  usersGet as GET,
  usersPost as POST,
  methodNotAllowed as PATCH,
  methodNotAllowed as PUT,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

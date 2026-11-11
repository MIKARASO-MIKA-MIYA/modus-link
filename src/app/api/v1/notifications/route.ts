export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { notificationsGet as GET } from "@/server/handlers";
export {
  methodNotAllowed as POST,
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

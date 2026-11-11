export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export {
  routingGet as GET,
  routingPost as POST,
  methodNotAllowed as PATCH,
  methodNotAllowed as PUT,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

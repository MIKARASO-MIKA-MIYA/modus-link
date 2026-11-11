import { NextRequest } from "next/server";
import { route, ok } from "@/server/http";
import { idSchema } from "@/server/validators";
import {
  listAttachments,
  uploadAttachment,
} from "@/server/services/attachments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export const GET = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) =>
    ok(await listAttachments(actor, idSchema.parse((await ctx.params).id))),
  );
export const POST = (req: NextRequest, ctx: Context) =>
  route(req, async (actor) =>
    ok(
      await uploadAttachment(actor, idSchema.parse((await ctx.params).id), req),
      201,
    ),
  );
export {
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

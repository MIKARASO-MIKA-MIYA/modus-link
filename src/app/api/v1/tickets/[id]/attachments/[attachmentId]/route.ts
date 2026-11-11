import { NextRequest } from "next/server";
import { route } from "@/server/http";
import { idSchema } from "@/server/validators";
import { downloadAttachment } from "@/server/services/attachments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (
  req: NextRequest,
  ctx: { params: Promise<{ id: string; attachmentId: string }> },
) =>
  route(req, async (actor) => {
    const p = await ctx.params;
    return downloadAttachment(
      actor,
      idSchema.parse(p.id),
      idSchema.parse(p.attachmentId),
    );
  });
export {
  methodNotAllowed as POST,
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
} from "@/server/handlers";

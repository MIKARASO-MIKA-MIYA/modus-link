import { TicketDetail } from "@/components/ticket-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketDetail key={id} id={id} />;
}

import { Suspense } from "react";
import { TicketsScreen } from "@/components/tickets-screen";
import { Loading } from "@/components/ui/shared";
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <TicketsScreen />
    </Suspense>
  );
}

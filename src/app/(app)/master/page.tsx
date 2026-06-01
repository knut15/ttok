// /master RSC 셸(T8-5, AC-12): client 가드/집계뷰(MasterView) 마운트만.
// role 진실원은 클라 컨텍스트(localStorage) → 가드는 MasterView(client) 책임.
import { MasterView } from "@/features/accounts/components/MasterView";

export default function MasterPage() {
  return <MasterView />;
}

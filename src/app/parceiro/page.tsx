import { redirect } from "next/navigation";
import { getAfiliadoSession } from "@/lib/afiliados/session";
import { ParceiroDashboardClient } from "@/components/parceiro/ParceiroDashboardClient";

export default async function ParceiroPage() {
  const session = await getAfiliadoSession();
  if (!session) redirect("/parceiro/login");
  return (
    <div className="min-h-screen bg-[#05070c] text-slate-100">
      <ParceiroDashboardClient />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getAfiliadoSession } from "@/lib/afiliados/session";
import { ParceiroLoginClient } from "@/components/parceiro/ParceiroLoginClient";

export default async function ParceiroLoginPage() {
  const session = await getAfiliadoSession();
  if (session) redirect("/parceiro");
  return (
    <div className="min-h-screen bg-[#05070c] text-slate-100">
      <ParceiroLoginClient />
    </div>
  );
}

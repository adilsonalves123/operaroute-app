import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoReceitaClient } from "@/components/dono/DonoReceitaClient";

export default async function DonoReceitaPage() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoReceitaClient email={session.email} />;
}

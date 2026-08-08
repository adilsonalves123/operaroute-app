import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoAfiliadosClient } from "@/components/dono/DonoAfiliadosClient";

export default async function DonoAfiliadosPage() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoAfiliadosClient email={session.email} />;
}

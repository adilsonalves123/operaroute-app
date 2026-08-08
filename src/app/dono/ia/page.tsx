import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoIaClient } from "@/components/dono/DonoIaClient";

export default async function DonoIaPage() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoIaClient email={session.email} />;
}

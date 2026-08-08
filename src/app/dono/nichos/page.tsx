import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoNichosFotosClient } from "@/components/dono/DonoNichosFotosClient";

export default async function DonoNichosFotosPage() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoNichosFotosClient email={session.email} />;
}

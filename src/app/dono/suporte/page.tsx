import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoSuporteClient } from "@/components/dono/DonoSuporteClient";

export default async function DonoSuportePage() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoSuporteClient email={session.email} />;
}

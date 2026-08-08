import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoAtividadeClient } from "@/components/dono/DonoAtividadeClient";

export default async function DonoAtividadePage() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoAtividadeClient email={session.email} />;
}

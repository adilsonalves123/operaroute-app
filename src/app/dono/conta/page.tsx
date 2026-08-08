import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoContaClient } from "@/components/dono/DonoContaClient";

export default async function Page() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoContaClient email={session.email} />;
}

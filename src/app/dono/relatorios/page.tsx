import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoRelatoriosClient } from "@/components/dono/DonoRelatoriosClient";

export default async function Page() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoRelatoriosClient email={session.email} />;
}

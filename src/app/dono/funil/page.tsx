import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoFunilClient } from "@/components/dono/DonoFunilClient";

export default async function DonoFunilPage() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoFunilClient email={session.email} />;
}

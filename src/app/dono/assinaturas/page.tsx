import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoAssinaturasClient } from "@/components/dono/DonoAssinaturasClient";

export default async function Page() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoAssinaturasClient email={session.email} />;
}

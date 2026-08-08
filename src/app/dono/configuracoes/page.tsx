import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoConfigClient } from "@/components/dono/DonoConfigClient";

export default async function Page() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoConfigClient email={session.email} />;
}

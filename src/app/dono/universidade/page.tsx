import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoUniversidadeClient } from "@/components/dono/DonoUniversidadeClient";

export default async function Page() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoUniversidadeClient email={session.email} />;
}

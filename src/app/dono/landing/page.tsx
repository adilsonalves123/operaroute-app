import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoLandingClient } from "@/components/dono/DonoLandingClient";

export default async function Page() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoLandingClient email={session.email} />;
}

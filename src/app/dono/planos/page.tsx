import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoPlanosClient } from "@/components/dono/DonoPlanosClient";

export default async function Page() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoPlanosClient email={session.email} />;
}

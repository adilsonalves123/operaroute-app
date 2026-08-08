import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoCommandClient } from "@/components/dono/DonoCommandClient";

export default async function DonoPage() {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  return <DonoCommandClient email={session.email} />;
}

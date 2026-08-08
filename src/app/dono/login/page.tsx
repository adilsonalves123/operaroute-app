import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoLoginClient } from "@/components/dono/DonoLoginClient";

export default async function DonoLoginPage() {
  const session = await getDonoSession();
  if (session) redirect("/dono");
  return <DonoLoginClient />;
}

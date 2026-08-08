import { redirect } from "next/navigation";
import { getProfile, getSession } from "@/lib/supabase/server";
import { isSuporteStaff } from "@/lib/suporte/staff";
import { SuporteInboxClient } from "@/components/suporte/SuporteInboxClient";

export default async function SuporteInboxPage() {
  const user = await getSession();
  const profile = await getProfile();
  if (!isSuporteStaff(user, profile)) {
    redirect("/suporte");
  }

  return <SuporteInboxClient />;
}

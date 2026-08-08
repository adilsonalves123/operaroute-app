import { getProfile, getSession } from "@/lib/supabase/server";
import { isSuporteStaff } from "@/lib/suporte/staff";
import { SuporteClient } from "@/components/suporte/SuporteClient";

export default async function SuportePage() {
  const user = await getSession();
  const profile = await getProfile();
  const isStaff = isSuporteStaff(user, profile);

  return <SuporteClient isStaff={isStaff} />;
}

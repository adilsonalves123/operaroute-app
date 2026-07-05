import { createClient, getProfile } from "@/lib/supabase/server";
import { PontosClient } from "./PontosClient";

export default async function PontosPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: pontos } = profile?.empresa_id
    ? await supabase
        .from("pontos")
        .select("*")
        .eq("empresa_id", profile.empresa_id)
        .order("nome")
    : { data: [] };

  return <PontosClient pontos={pontos ?? []} />;
}

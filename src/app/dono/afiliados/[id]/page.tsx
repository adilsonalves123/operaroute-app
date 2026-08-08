import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoAfiliadoDetailClient } from "@/components/dono/DonoAfiliadoDetailClient";

export default async function DonoAfiliadoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  const { id } = await params;
  return <DonoAfiliadoDetailClient id={id} email={session.email} />;
}

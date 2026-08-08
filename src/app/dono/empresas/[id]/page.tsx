import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoEmpresaDetailClient } from "@/components/dono/DonoEmpresaDetailClient";

export default async function DonoEmpresaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  const { id } = await params;
  return <DonoEmpresaDetailClient empresaId={id} email={session.email} />;
}

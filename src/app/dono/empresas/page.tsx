import { redirect } from "next/navigation";
import { getDonoSession } from "@/lib/dono/session";
import { DonoEmpresasClient } from "@/components/dono/DonoEmpresasClient";

export default async function DonoEmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ saude?: string; q?: string }>;
}) {
  const session = await getDonoSession();
  if (!session) redirect("/dono/login");
  const sp = await searchParams;
  return (
    <DonoEmpresasClient
      email={session.email}
      saudeInicial={sp.saude ?? "todos"}
      qInicial={sp.q ?? ""}
    />
  );
}

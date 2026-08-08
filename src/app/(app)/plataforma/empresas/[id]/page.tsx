import { redirect } from "next/navigation";

export default async function PlataformaEmpresaRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dono/empresas/${id}`);
}

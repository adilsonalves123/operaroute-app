import { ModulePage } from "@/components/layout/ModulePage";

export default function EstoquePage() {
  return (
    <ModulePage
      title="Estoque"
      description="Controle de brindes e materiais"
      emptyTitle="Estoque vazio"
      emptyDescription="Seu estoque ainda está vazio. Cadastre seus primeiros itens."
      actionLabel="Novo item"
      actionHref="#"
    />
  );
}

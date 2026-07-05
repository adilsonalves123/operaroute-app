import { ModulePage } from "@/components/layout/ModulePage";

export default function EquipePage() {
  return (
    <ModulePage
      title="Equipe"
      description="Gerencie funcionários e permissões"
      emptyTitle="Sem membros na equipe"
      emptyDescription="Adicione operadores e gerentes à sua operação."
      actionLabel="Adicionar membro"
      actionHref="#"
    />
  );
}

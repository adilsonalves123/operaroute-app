import { ModulePage } from "@/components/layout/ModulePage";

export default function MateriaisPage() {
  return (
    <ModulePage
      title="Materiais"
      description="Downloads, checklists, modelos e scripts"
      emptyTitle="Sem materiais disponíveis"
      emptyDescription="Materiais serão disponibilizados conforme você avança nos cursos."
      actionLabel="Ver cursos"
      actionHref="/universidade"
    />
  );
}

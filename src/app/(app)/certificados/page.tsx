import { ModulePage } from "@/components/layout/ModulePage";

export default function CertificadosPage() {
  return (
    <ModulePage
      title="Certificados"
      description="Seus certificados da Universidade OperaRoute"
      emptyTitle="Nenhum certificado"
      emptyDescription="Complete cursos na Universidade para ganhar certificados."
      actionLabel="Ir para Universidade"
      actionHref="/universidade"
    />
  );
}

import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Termos de uso — OperaRoute",
  description: "Termos de uso da plataforma OperaRoute.",
};

export default function TermosPage() {
  return (
    <LegalShell title="Termos de uso" updated="22 de julho de 2026">
      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">1. Aceitação</h2>
        <p>
          Ao criar uma conta ou usar o OperaRoute, você concorda com estes Termos.
          Se não concordar, não utilize o serviço.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">2. O serviço</h2>
        <p>
          O OperaRoute é uma plataforma de gestão operacional (pontos, coletas,
          financeiro, rotas, equipe e recursos relacionados) oferecida em modelo
          SaaS, com planos pagos e período de teste gratuito, quando aplicável.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">3. Conta e responsabilidade</h2>
        <p>
          Você é responsável por manter a confidencialidade do login, pela
          veracidade dos dados cadastrais e pelo uso feito por sua equipe.
          Informe-nos imediatamente em caso de acesso não autorizado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">4. Teste grátis e planos</h2>
        <p>
          O período de teste (quando oferecido) tem duração limitada e pode
          restringir ou encerrar o acesso ao término, até a contratação de um
          plano. Valores, limites e condições comerciais vigentes aparecem em
          Planos / no painel do titular.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">5. Uso aceitável</h2>
        <p>
          É proibido usar o OperaRoute para fins ilícitos, tentar violar a
          segurança do sistema, sobrecarregar a infraestrutura de forma abusiva
          ou infringir direitos de terceiros. Podemos suspender contas que
          violem estas regras.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">6. Dados da operação</h2>
        <p>
          Os dados que você e sua equipe inserem (pontos, coletas, valores etc.)
          pertencem à sua operação. Tratamos esses dados conforme a Política de
          Privacidade e a legislação aplicável (incluindo a LGPD).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">7. Disponibilidade</h2>
        <p>
          Buscamos alta disponibilidade, mas o serviço pode sofrer manutenções,
          falhas ou interrupções. Não garantimos funcionamento ininterrupto nem
          ausência total de erros.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">8. Limitação de responsabilidade</h2>
        <p>
          Na máxima extensão permitida pela lei, o OperaRoute não se responsabiliza
          por lucros cessantes, perda de dados derivada de uso inadequado, ou
          danos indiretos decorrentes do uso da plataforma.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">9. Alterações</h2>
        <p>
          Podemos atualizar estes Termos. A data no topo indica a versão vigente.
          O uso continuado após alterações constitui aceitação da nova versão.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">10. Contato</h2>
        <p>
          Dúvidas sobre estes Termos: use o canal de{" "}
          <a href="/login" className="text-[#c9a87c] hover:underline">
            suporte
          </a>{" "}
          indicado no login ou no aplicativo.
        </p>
      </section>
    </LegalShell>
  );
}

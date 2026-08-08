import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Privacidade — OperaRoute",
  description: "Política de privacidade da plataforma OperaRoute.",
};

export default function PrivacidadePage() {
  return (
    <LegalShell title="Política de privacidade" updated="22 de julho de 2026">
      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">1. Quem somos</h2>
        <p>
          Esta política descreve como o OperaRoute trata dados pessoais no
          contexto da plataforma de gestão operacional, em conformidade com a
          Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">2. Dados que coletamos</h2>
        <p>Podemos tratar, conforme o uso do serviço:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Dados de cadastro: nome, e-mail, telefone/WhatsApp;</li>
          <li>Dados da operação: pontos, coletas, financeiro, rotas, equipe;</li>
          <li>Dados técnicos: IP, dispositivo, logs de acesso e segurança;</li>
          <li>Comunicações de suporte e mensagens enviadas a nós.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">3. Finalidades</h2>
        <p>Usamos os dados para:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>criar e autenticar contas;</li>
          <li>prestar e melhorar o serviço;</li>
          <li>cobrança, planos e suporte;</li>
          <li>segurança, prevenção a fraudes e cumprimento legal;</li>
          <li>comunicações essenciais sobre a conta (ex.: confirmação por e-mail, SMS ou WhatsApp).</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">4. Bases legais</h2>
        <p>
          O tratamento ocorre com base na execução de contrato, legítimo
          interesse (quando aplicável e com salvaguardas), consentimento quando
          exigido, e cumprimento de obrigação legal.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">5. Compartilhamento</h2>
        <p>
          Podemos compartilhar dados com provedores de infraestrutura
          (hospedagem, autenticação, e-mail) estritamente necessários à
          operação, sob obrigações de confidencialidade. Não vendemos seus
          dados pessoais.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">6. Retenção</h2>
        <p>
          Mantemos os dados enquanto a conta estiver ativa e pelo tempo
          necessário a obrigações legais, disputas ou segurança. Recursos do
          produto (ex.: retenção de mídia) podem ter prazos próprios configuráveis.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">7. Seus direitos (LGPD)</h2>
        <p>
          Você pode solicitar confirmação de tratamento, acesso, correção,
          anonimização, portabilidade, eliminação (quando cabível), informação
          sobre compartilhamentos e revogação de consentimento. Para exercer
          direitos, use o canal de suporte do OperaRoute.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">8. Segurança</h2>
        <p>
          Aplicamos medidas técnicas e organizacionais razoáveis (controle de
          acesso, criptografia em trânsito quando aplicável, segregação de
          ambientes). Nenhum sistema é 100% seguro.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">9. Cookies e similares</h2>
        <p>
          Usamos cookies/sessões essenciais para autenticação e funcionamento do
          app. Sem eles, o login e o painel podem não funcionar.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">10. Alterações</h2>
        <p>
          Podemos atualizar esta política. A data no topo indica a versão
          vigente.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">11. Contato</h2>
        <p>
          Para questões de privacidade, fale conosco pelo suporte indicado no
          login ou no aplicativo.
        </p>
      </section>
    </LegalShell>
  );
}

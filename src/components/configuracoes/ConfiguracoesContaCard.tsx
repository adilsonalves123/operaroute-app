import Link from "next/link";
import { Mail, MessageCircle, User } from "lucide-react";
import {
  champagneLink,
  ConfigDataGrid,
  ConfigDataRow,
  ConfigPanelBody,
} from "@/components/configuracoes/configuracoes-ui";

type Props = {
  nome: string;
  email: string | null;
  whatsapp: string | null;
  embedded?: boolean;
};

export function ConfiguracoesContaCard({
  nome,
  email,
  whatsapp,
  embedded = false,
}: Props) {
  const inner = (
    <>
      <ConfigDataGrid>
        <ConfigDataRow label="Nome" value={nome || "—"} />
        <ConfigDataRow label="E-mail" value={email || "—"} />
        {whatsapp ? <ConfigDataRow label="WhatsApp" value={whatsapp} /> : null}
      </ConfigDataGrid>
      <p className="mt-4 text-[12px] text-slate-500 leading-relaxed border-t border-white/[0.06] pt-4">
        Alteração de e-mail ou senha via{" "}
        <Link href="/suporte" className={champagneLink}>
          suporte
        </Link>
        — por segurança, não alteramos credenciais aqui.
      </p>
    </>
  );

  if (embedded) {
    return <ConfigPanelBody>{inner}</ConfigPanelBody>;
  }

  return <div className="glass-card p-6 space-y-3">{inner}</div>;
}

import Link from "next/link";
import { ArrowUpRight, LifeBuoy, Users } from "lucide-react";
import { ConfigPanelBody } from "@/components/configuracoes/configuracoes-ui";

const links = [
  {
    href: "/equipe",
    icon: Users,
    title: "Equipe e permissões",
    desc: "Convites, cargos e o que cada colaborador pode acessar",
  },
  {
    href: "/suporte",
    icon: LifeBuoy,
    title: "Central de suporte",
    desc: "Dúvidas, acesso à conta e problemas técnicos",
  },
];

export function ConfiguracoesAtalhosCard({ embedded = false }: { embedded?: boolean }) {
  const inner = (
    <div className="grid gap-px sm:grid-cols-2 bg-white/[0.04]">
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-start gap-3 bg-[#0a0e16]/80 p-5 transition hover:bg-[#c4a574]/[0.06]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#c4a574]/20 bg-[#c4a574]/8 text-[#c4a574] transition group-hover:border-[#c4a574]/40">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="font-medium text-[#f4efe6] group-hover:text-[#e8d5b0] transition">
                  {item.title}
                </p>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-[#c4a574] transition" />
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                {item.desc}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );

  if (embedded) return inner;
  return <div className="glass-card overflow-hidden">{inner}</div>;
}

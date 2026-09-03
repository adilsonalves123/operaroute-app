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
    <div className="grid gap-px sm:grid-cols-2 bg-at-card-soft">
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-start gap-3 bg-at-card-soft p-5 transition hover:bg-at-card-soft"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-at bg-at-card-soft text-at-link transition group-hover:border-[#c4a574]/40">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="font-medium text-at-primary group-hover:text-at-link transition">
                  {item.title}
                </p>
                <ArrowUpRight className="h-3.5 w-3.5 text-at-soft group-hover:text-at-link transition" />
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-at-muted">
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

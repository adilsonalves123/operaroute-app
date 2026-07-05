import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Package, MessageCircle, Pencil, CircleDot } from "lucide-react";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { EquipamentosSection } from "@/components/pontos/EquipamentosSection";
import { PontoCassinoSettings } from "@/components/pontos/PontoCassinoSettings";
import { PontoFuraFuraSettings } from "@/components/pontos/PontoFuraFuraSettings";
import { PontoExcluirButton } from "@/components/pontos/PontoExcluirButton";
import { PontoFuraAlertas } from "@/components/coletas/fura-fura/PontoFuraAlertas";
import { formatDate, formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { centesimosToReais, formatContador } from "@/lib/nichos/cassino";
import { saldoPendenciaReais } from "@/lib/nichos/cassino/pendencias";

export default async function PontoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const supabase = await createClient();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const isCassino = nichosAtivos.includes("maquinas_cassino");
  const isFuraFura = nichosAtivos.includes("fura_fura");

  const { data: ponto } = await supabase
    .from("pontos")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", profile?.empresa_id ?? "")
    .single();

  if (!ponto) notFound();

  const { data: equipamentos } = await supabase
    .from("equipamentos")
    .select("*")
    .eq("ponto_id", id)
    .order("created_at");

  const { data: todosPontos } = profile?.empresa_id
    ? await supabase
        .from("pontos")
        .select("id, nome")
        .eq("empresa_id", profile.empresa_id)
        .neq("id", id)
        .order("nome")
    : { data: [] };

  const { data: visitas } = isCassino
    ? await supabase
        .from("visitas")
        .select("id, created_at, total_lucro_centavos, valor_operacao, saldo_negativo")
        .eq("ponto_id", id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: null };

  const { count: visitasCount } = isCassino
    ? await supabase
        .from("visitas")
        .select("id", { count: "exact", head: true })
        .eq("ponto_id", id)
    : { count: 0 };

  const { data: coletasFura } = isFuraFura
    ? await supabase
        .from("coletas")
        .select("id, created_at, valor_liquido, lucro_real, quantidade_furos, nicho_modulo")
        .eq("ponto_id", id)
        .eq("nicho_modulo", "fura_fura")
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: null };

  const { count: coletasFuraCount } = isFuraFura
    ? await supabase
        .from("coletas")
        .select("id", { count: "exact", head: true })
        .eq("ponto_id", id)
        .eq("nicho_modulo", "fura_fura")
    : { count: 0 };

  const { data: coletas } = !isCassino && !isFuraFura
    ? await supabase
        .from("coletas")
        .select("*")
        .eq("ponto_id", id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: null };

  const { count: coletasCount } = !isCassino && !isFuraFura
    ? await supabase
        .from("coletas")
        .select("id", { count: "exact", head: true })
        .eq("ponto_id", id)
    : { count: 0 };

  const { data: pendenciasAbertas } = await supabase
    .from("pendencias")
    .select("id, tipo, valor, titulo, descricao")
    .eq("ponto_id", id)
    .eq("status", "aberta");

  const pendenciasCobraveis = (pendenciasAbertas ?? []).filter((p) => p.tipo !== "haver");
  const totalCobravel = pendenciasCobraveis.reduce((total, p) => {
    const valor =
      p.tipo === "negativo"
        ? saldoPendenciaReais({
            id: p.id,
            valor: Number(p.valor ?? 0),
            observacao: p.descricao,
          })
        : Number(p.valor ?? 0);
    return total + valor;
  }, 0);

  const cobrarUrl =
    ponto.whatsapp && totalCobravel > 0.009
      ? `https://wa.me/55${ponto.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
          [
            `Olá, ${ponto.nome}.`,
            "",
            `Constam pendências abertas no valor de ${formatCurrency(totalCobravel)}.`,
            "",
            ...pendenciasCobraveis.map((p) => {
              const valor =
                p.tipo === "negativo"
                  ? saldoPendenciaReais({
                      id: p.id,
                      valor: Number(p.valor ?? 0),
                      observacao: p.descricao,
                    })
                  : Number(p.valor ?? 0);
              return `• ${p.titulo}: ${formatCurrency(valor)}`;
            }),
            "",
            "Pode verificar o pagamento, por favor?",
          ].join("\n")
        )}`
      : null;

  const statusVariant = {
    ativo: "success" as const,
    pausado: "warning" as const,
    retirado: "default" as const,
    inadimplente: "danger" as const,
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/pontos" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{ponto.nome}</h1>
            <AlertBadge variant={statusVariant[ponto.status as keyof typeof statusVariant]}>
              {ponto.status}
            </AlertBadge>
          </div>
          <p className="text-slate-400 text-sm">
            {[ponto.endereco, ponto.bairro, ponto.cidade].filter(Boolean).join(", ")}
          </p>
          {isFuraFura && (
            <PontoFuraAlertas ponto={ponto} className="mt-2" />
          )}
        </div>
      </div>

      <div className={cn("grid gap-3", isCassino && isFuraFura ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
        <Link
          href={`/pontos/${id}/editar`}
          className="glass-card p-4 flex items-center gap-3 hover:border-primary-neon/30 transition"
        >
          <Pencil className="h-5 w-5 text-primary-neon" />
          <span className="text-sm font-medium">Editar ponto</span>
        </Link>
        {isCassino && (
          <Link
            href={`/coletas/nova/cassino?ponto=${id}`}
            className="glass-card p-4 flex items-center gap-3 hover:border-emerald-500/30 transition border-emerald-500/10"
          >
            <Package className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-medium">Nova leitura</span>
          </Link>
        )}
        {isFuraFura && (
          <Link
            href={`/coletas/nova/fura-fura?ponto=${id}`}
            className="glass-card p-4 flex items-center gap-3 hover:border-amber-500/30 transition border-amber-500/10"
          >
            <CircleDot className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-medium">Coleta fura-fura</span>
          </Link>
        )}
        {ponto.whatsapp && (
          <a
            href={`https://wa.me/55${ponto.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-card p-4 flex items-center gap-3 hover:border-green-500/30 transition"
          >
            <MessageCircle className="h-5 w-5 text-green-400" />
            <span className="text-sm font-medium">WhatsApp</span>
          </a>
        )}
        {cobrarUrl && (
          <a
            href={cobrarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-card p-4 flex items-center gap-3 hover:border-amber-500/30 transition"
          >
            <MessageCircle className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-medium">Cobrar</span>
          </a>
        )}
        <Link
          href="/pendencias"
          className="glass-card p-4 flex items-center gap-3 hover:border-amber-500/30 transition"
        >
          <MapPin className="h-5 w-5 text-amber-400" />
          <span className="text-sm font-medium">
            Pendências ({pendenciasAbertas?.length ?? 0})
          </span>
        </Link>
      </div>

      <div className="glass-card p-6 space-y-3">
        <h2 className="font-semibold text-white">Dados do ponto</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-slate-400">Responsável:</span>{" "}
            <span className="text-white">{ponto.responsavel ?? "—"}</span>
          </div>
          <div>
            <span className="text-slate-400">Comissão:</span>{" "}
            <span className="text-white">{ponto.comissao_percentual}%</span>
          </div>
          <div>
            <span className="text-slate-400">Última coleta:</span>{" "}
            <span className="text-white">
              {ponto.ultima_coleta ? formatDate(ponto.ultima_coleta) : "Nunca"}
            </span>
          </div>
        </div>
        {ponto.observacoes && <p className="text-sm text-slate-400 mt-2">{ponto.observacoes}</p>}
      </div>

      {isCassino && (
        <PontoCassinoSettings
          pontoId={id}
          abaterAutomatico={ponto.abater_automatico !== false}
          comissaoPercentual={Number(ponto.comissao_percentual) || 0}
        />
      )}

      {isFuraFura && (
        <PontoFuraFuraSettings
          pontoId={id}
          precoFuro={Number(ponto.preco_furo ?? 1)}
          furosEstoque={ponto.furos_estoque ?? null}
          furosMinimo={Number(ponto.furos_minimo ?? 0)}
          comissaoPercentual={Number(ponto.comissao_percentual) || 0}
          estoqueBrindes={
            Array.isArray(ponto.estoque_brindes) ? ponto.estoque_brindes : []
          }
        />
      )}

      <EquipamentosSection
        pontoId={id}
        equipamentos={equipamentos ?? []}
        outrosPontos={todosPontos ?? []}
        nichosAtivos={nichosAtivos}
      />

      <div className="glass-card p-6 space-y-6">
        {isCassino && isFuraFura ? (
          <>
            <div>
              <h2 className="font-semibold text-white mb-4">Histórico de visitas (cassino)</h2>
              {!visitas?.length ? (
                <p className="text-sm text-slate-400">Nenhuma visita registrada.</p>
              ) : (
                <div className="space-y-2">
                  {visitas.map((v) => (
                    <Link
                      key={v.id}
                      href={`/coletas/visita/${v.id}`}
                      className="flex justify-between py-2 border-b border-slate-800 last:border-0 hover:text-primary-neon"
                    >
                      <span className="text-sm text-slate-400">{formatDateTime(v.created_at)}</span>
                      <span className="text-sm font-medium text-green-400">
                        {v.saldo_negativo
                          ? "Negativo"
                          : formatContador(Number(v.total_lucro_centavos))}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-white mb-4">Histórico de coletas (fura-fura)</h2>
              {!coletasFura?.length ? (
                <p className="text-sm text-slate-400">Nenhuma coleta fura-fura registrada.</p>
              ) : (
                <div className="space-y-2">
                  {coletasFura.map((c) => (
                    <Link
                      key={c.id}
                      href={`/coletas/fura-fura/${c.id}`}
                      className="flex justify-between py-2 border-b border-slate-800 last:border-0 hover:text-amber-400"
                    >
                      <span className="text-sm text-slate-400">{formatDateTime(c.created_at)}</span>
                      <span className="text-sm font-medium text-green-400">
                        {formatCurrency(Number(c.lucro_real ?? c.valor_liquido ?? 0))}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-white mb-4">
              {isCassino ? "Histórico de visitas" : "Histórico de coletas"}
            </h2>
            {isCassino ? (
              !visitas?.length ? (
                <p className="text-sm text-slate-400">Nenhuma visita registrada.</p>
              ) : (
                <div className="space-y-2">
                  {visitas.map((v) => (
                    <Link
                      key={v.id}
                      href={`/coletas/visita/${v.id}`}
                      className="flex justify-between py-2 border-b border-slate-800 last:border-0 hover:text-primary-neon"
                    >
                      <span className="text-sm text-slate-400">{formatDateTime(v.created_at)}</span>
                      <span className="text-sm font-medium text-green-400">
                        {v.saldo_negativo
                          ? "Negativo"
                          : formatContador(Number(v.total_lucro_centavos))}
                      </span>
                    </Link>
                  ))}
                </div>
              )
            ) : isFuraFura ? (
              !coletasFura?.length ? (
                <p className="text-sm text-slate-400">Nenhuma coleta registrada.</p>
              ) : (
                <div className="space-y-2">
                  {coletasFura.map((c) => (
                    <Link
                      key={c.id}
                      href={`/coletas/fura-fura/${c.id}`}
                      className="flex justify-between py-2 border-b border-slate-800 last:border-0 hover:text-amber-400"
                    >
                      <span className="text-sm text-slate-400">{formatDateTime(c.created_at)}</span>
                      <span className="text-sm font-medium text-green-400">
                        {formatCurrency(Number(c.lucro_real ?? c.valor_liquido ?? 0))}
                      </span>
                    </Link>
                  ))}
                </div>
              )
            ) : !coletas?.length ? (
              <p className="text-sm text-slate-400">Nenhuma coleta registrada.</p>
            ) : (
              <div className="space-y-2">
                {coletas.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between py-2 border-b border-slate-800 last:border-0"
                  >
                    <span className="text-sm text-slate-400">{formatDate(c.created_at)}</span>
                    <span className="text-sm font-medium text-green-400">
                      {formatCurrency(Number(c.valor_liquido))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="glass-card border border-red-500/15 p-6 space-y-3">
        <h2 className="font-semibold text-white">Zona de perigo</h2>
        <p className="text-sm text-slate-400">
          Excluir remove o ponto, equipamentos e histórico de visitas/coletas vinculados. Pendências
          de negativo ou operação em aberto impedem a exclusão.
        </p>
        <PontoExcluirButton
          pontoId={id}
          pontoNome={ponto.nome}
          equipamentosCount={equipamentos?.length ?? 0}
          visitasCount={visitasCount ?? 0}
          coletasCount={(coletasFuraCount ?? 0) + (coletasCount ?? 0)}
          pendenciasCobraveisCount={pendenciasCobraveis.length}
        />
      </div>
    </div>
  );
}

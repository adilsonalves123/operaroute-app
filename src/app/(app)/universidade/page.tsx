import { DataCard } from "@/components/cards/DataCard";
import { GraduationCap, Play, Award, BookOpen } from "lucide-react";
import Link from "next/link";

const categorias = ["Começando", "Operação", "Financeiro", "Crescimento", "Avançado"];

const cursos = [
  { titulo: "Primeiro acesso: por onde começar", categoria: "Começando", duracao: "12 min", progresso: 0 },
  { titulo: "Como cadastrar pontos corretamente", categoria: "Operação", duracao: "18 min", progresso: 0 },
  { titulo: "Como fazer uma coleta perfeita", categoria: "Operação", duracao: "15 min", progresso: 0 },
  { titulo: "Como organizar o financeiro", categoria: "Financeiro", duracao: "22 min", progresso: 0 },
  { titulo: "Como montar rotas inteligentes", categoria: "Operação", duracao: "16 min", progresso: 0 },
  { titulo: "Como cobrar clientes", categoria: "Crescimento", duracao: "14 min", progresso: 0 },
  { titulo: "Como crescer sua operação", categoria: "Crescimento", duracao: "25 min", progresso: 0 },
];

export default function UniversidadePage() {
  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl glass-card p-8 border border-blue-500/20">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-neon/20">
            <GraduationCap className="h-7 w-7 text-primary-neon" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Universidade OperaRoute</h1>
            <p className="text-slate-400 mt-1">Aprenda a dominar sua operação</p>
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-4 mt-6">
          {[
            { label: "Cursos disponíveis", value: cursos.length },
            { label: "Aulas iniciadas", value: 0 },
            { label: "Concluídas", value: 0 },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-primary-neon">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Categorias</h2>
        <div className="flex flex-wrap gap-2">
          {categorias.map((cat) => (
            <span key={cat} className="rounded-full border border-blue-500/30 px-4 py-1.5 text-sm text-slate-300">
              {cat}
            </span>
          ))}
        </div>
      </div>

      <DataCard title="Cursos em destaque">
        <div className="grid gap-4 sm:grid-cols-2">
          {cursos.map((curso) => (
            <div key={curso.titulo} className="glass-card p-4 hover:border-primary-neon/30 transition cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <Play className="h-4 w-4 text-primary-neon" />
                </div>
                <div>
                  <p className="font-medium text-white text-sm">{curso.titulo}</p>
                  <p className="text-xs text-slate-500 mt-1">{curso.categoria} · {curso.duracao}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DataCard>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/certificados" className="glass-card p-5 hover:border-primary-neon/30 transition flex items-center gap-3">
          <Award className="h-5 w-5 text-amber-400" />
          <span className="text-sm font-medium text-white">Certificados</span>
        </Link>
        <Link href="/materiais" className="glass-card p-5 hover:border-primary-neon/30 transition flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-primary-neon" />
          <span className="text-sm font-medium text-white">Materiais</span>
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Crown,
  KeyRound,
  LogIn,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Shield,
  Trash2,
  User,
  UserCog,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormInput, FormSelect } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { labelRole, ROLES_CADASTRO } from "@/lib/equipe/roles";
import {
  mesclarPermissoes,
  normalizarOverrides,
  overridesDaMatriz,
  permissoesPadraoRole,
  type PermissoesResolvidas,
} from "@/lib/equipe/permissions";
import { PermissoesMatrix } from "@/components/equipe/PermissoesMatrix";
import {
  canAddMembroEquipe,
  contarMembrosEquipeAtivos,
  getLimiteUsuariosEquipe,
} from "@/lib/equipe/limits";
import type { EquipeMember, UserRole } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type ModoLogin = "senha" | "convite";

type FormState = {
  nome: string;
  email: string;
  whatsapp: string;
  role: UserRole;
  comissao_percentual: string;
  status: "ativo" | "inativo";
  criar_login: boolean;
  modo_login: ModoLogin;
  senha: string;
};

const emptyForm = (): FormState => ({
  nome: "",
  email: "",
  whatsapp: "",
  role: "operador",
  comissao_percentual: "0",
  status: "ativo",
  criar_login: true,
  modo_login: "senha",
  senha: "",
});

function roleBadgeClass(role: UserRole) {
  switch (role) {
    case "admin":
      return "border border-at bg-at-card-soft text-at-primary";
    case "gerente":
      return "border border-[#c4a574]/30 bg-[#c4a574]/08 text-at-link";
    case "operador":
      return "border border-at bg-at-card-soft text-at-muted";
    default:
      return "border border-at bg-at-card-soft text-at-muted";
  }
}

function RoleIcon({ role }: { role: UserRole }) {
  if (role === "admin") return <Crown className="h-4 w-4" />;
  if (role === "gerente") return <UserCog className="h-4 w-4" />;
  if (role === "operador") return <User className="h-4 w-4" />;
  return <Shield className="h-4 w-4" />;
}

type ApiDebugInfo = {
  label: string;
  url: string;
  status: number;
  statusText: string;
  requestBody?: unknown;
  responseBody: unknown;
  responseText: string;
  timestamp: string;
};

function extrairErroApi(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as Record<string, unknown>;
  if (typeof d.error === "string" && d.error.trim()) return d.error;
  if (d.error && typeof d.error === "object") {
    const o = d.error as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message;
    if (Object.keys(o).length > 0) {
      return `${fallback}: ${JSON.stringify(o)}`;
    }
    return `${fallback} (campo "error" vazio — veja Debug abaixo)`;
  }
  if (typeof d.message === "string" && d.message.trim()) return d.message;
  if (typeof d.code === "string" && d.code.trim()) {
    return `${fallback} (${d.code})`;
  }
  if (Array.isArray(d.debug) && d.debug.length > 0) {
    return `${fallback}\n${(d.debug as string[]).join("\n")}`;
  }
  const keys = Object.keys(d);
  if (keys.length > 0) {
    return `${fallback} — resposta: ${JSON.stringify(d)}`;
  }
  return fallback;
}

async function fetchComDebug(
  label: string,
  url: string,
  init: RequestInit | undefined,
  onDebug: (info: ApiDebugInfo) => void
): Promise<{ res: Response; data: unknown }> {
  const res = await fetch(url, init);
  const rawText = await res.text();
  let data: unknown = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = { _parseError: true, raw: rawText.slice(0, 2000) };
  }

  let requestBody: unknown;
  if (init?.body && typeof init.body === "string") {
    try {
      requestBody = JSON.parse(init.body);
    } catch {
      requestBody = init.body;
    }
  }

  const info: ApiDebugInfo = {
    label,
    url,
    status: res.status,
    statusText: res.statusText,
    requestBody,
    responseBody: data,
    responseText: rawText.slice(0, 4000),
    timestamp: new Date().toISOString(),
  };
  onDebug(info);
  console.info("[OperaRoute debug]", info);

  return { res, data };
}

export function EquipeClient({
  membros: initialMembros,
  limiteUsuarios,
  loginDisponivel,
  podeGerenciarEquipe,
}: {
  membros: EquipeMember[];
  limiteUsuarios: number;
  loginDisponivel: boolean;
  podeGerenciarEquipe: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [sucessoLogin, setSucessoLogin] = useState<string | null>(null);

  const [loginMembroId, setLoginMembroId] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginModo, setLoginModo] = useState<ModoLogin>("senha");
  const [loginSenha, setLoginSenha] = useState("");
  const [apiDebug, setApiDebug] = useState<ApiDebugInfo | null>(null);
  const [permissoesMatriz, setPermissoesMatriz] = useState<PermissoesResolvidas>(
    permissoesPadraoRole("operador")
  );
  const [permissoesPersonalizado, setPermissoesPersonalizado] = useState(false);

  const colaboradoresAtivos = contarMembrosEquipeAtivos(initialMembros);
  const limiteColaboradores = getLimiteUsuariosEquipe(limiteUsuarios);
  const podeAdicionar = canAddMembroEquipe(colaboradoresAtivos, limiteUsuarios);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setPermissoesMatriz(permissoesPadraoRole("operador"));
    setPermissoesPersonalizado(false);
    setShowForm(true);
    setMsg("");
    setSucessoLogin(null);
  }

  function openEdit(membro: EquipeMember) {
    setEditingId(membro.id);
    setForm({
      nome: membro.nome,
      email: membro.email ?? "",
      whatsapp: membro.whatsapp ?? "",
      role: membro.role,
      comissao_percentual: String(membro.comissao_percentual ?? 0),
      status: membro.status === "inativo" ? "inativo" : "ativo",
      criar_login: false,
      modo_login: "senha",
      senha: "",
    });
    const overrides = normalizarOverrides(membro.permissoes);
    setPermissoesMatriz(mesclarPermissoes(membro.role, overrides));
    setPermissoesPersonalizado(Boolean(overrides));
    setShowForm(true);
    setMsg("");
    setSucessoLogin(null);
  }

  function openLoginModal(membro: EquipeMember) {
    setLoginMembroId(membro.id);
    setLoginEmail(membro.email ?? "");
    setLoginModo("senha");
    setLoginSenha("");
    setMsg("");
    setSucessoLogin(null);
    setApiDebug(null);
  }

  function closeLoginModal() {
    setLoginMembroId(null);
    setLoginEmail("");
    setLoginSenha("");
    setApiDebug(null);
  }

  const editingMembro = editingId
    ? initialMembros.find((m) => m.id === editingId)
    : null;
  const editingAdmin = editingMembro?.role === "admin";
  const loginMembro = loginMembroId
    ? initialMembros.find((m) => m.id === loginMembroId)
    : null;

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setPermissoesPersonalizado(false);
    setMsg("");
  }

  function mostrarSucessoLogin(data: {
    login?: { senhaTemporaria?: string; conviteEnviado?: boolean };
  }) {
    if (data.login?.conviteEnviado) {
      setSucessoLogin("Convite enviado por e-mail. O membro deve definir a senha no link recebido.");
      return;
    }
    if (data.login?.senhaTemporaria) {
      setSucessoLogin(
        `Login criado! Senha inicial: ${data.login.senhaTemporaria} — anote e repasse ao membro.`
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setMsg("Informe o nome.");
      return;
    }

    if (!editingId && form.criar_login && loginDisponivel) {
      if (!form.email.trim()) {
        setMsg("Informe o e-mail para criar o login.");
        return;
      }
      if (form.modo_login === "senha" && form.senha.length < 6) {
        setMsg("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
    }

    setLoading(true);
    setMsg("");
    setSucessoLogin(null);

    const payload: Record<string, unknown> = {
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      comissao_percentual: Number(form.comissao_percentual) || 0,
    };

    if (!editingAdmin) {
      payload.role = form.role;
      payload.status = form.status;
      payload.permissoes = permissoesPersonalizado
        ? overridesDaMatriz(form.role, permissoesMatriz)
        : null;
    }

    if (!editingId && form.criar_login && loginDisponivel) {
      payload.criar_login = true;
      payload.modo_login = form.modo_login;
      if (form.modo_login === "senha") {
        payload.senha = form.senha;
      }
    }

    try {
      const url = editingId ? `/api/equipe/${editingId}` : "/api/equipe";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(extrairErroApi(data, "Erro ao salvar membro."));
        return;
      }

      closeForm();
      if (data.vinculado) {
        setSucessoLogin("Login vinculado ao membro que já existia na equipe.");
      } else {
        mostrarSucessoLogin(data as Parameters<typeof mostrarSucessoLogin>[0]);
      }
      router.refresh();
    } catch {
      setMsg("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCriarLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginMembroId) return;
    if (!loginEmail.trim()) {
      setMsg("Informe o e-mail.");
      return;
    }
    if (loginModo === "senha" && loginSenha.length < 6) {
      setMsg("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setMsg("");
    setSucessoLogin(null);
    setApiDebug(null);

    const loginUrl = `/api/equipe/${loginMembroId}/login`;
    const loginPayload = {
      email: loginEmail.trim(),
      modo_login: loginModo,
      senha: loginModo === "senha" ? loginSenha : undefined,
    };

    try {
      const { res, data } = await fetchComDebug(
        "criar login",
        loginUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loginPayload),
        },
        setApiDebug
      );

      if (!res.ok) {
        setMsg(extrairErroApi(data, "Erro ao criar login."));
        return;
      }

      closeLoginModal();
      mostrarSucessoLogin(data as Parameters<typeof mostrarSucessoLogin>[0]);
      router.refresh();
    } catch {
      setMsg("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRedefinirSenha(membro: EquipeMember) {
    if (!membro.user_id) return;
    const novaSenha = prompt("Nova senha (mínimo 6 caracteres):");
    if (!novaSenha) return;
    if (novaSenha.length < 6) {
      setMsg("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/equipe/${membro.id}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redefinir_senha", senha: novaSenha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(extrairErroApi(data, "Erro ao redefinir senha."));
        return;
      }
      setSucessoLogin(`Senha atualizada: ${data.senhaTemporaria}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(membro: EquipeMember) {
    if (membro.role === "admin") return;
    if (!confirm(`Remover ${membro.nome} da equipe?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/equipe/${membro.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao remover membro.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const roleOptions = ROLES_CADASTRO.map((r) => ({
    value: r,
    label: labelRole(r),
  }));

  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay show={loading} />}

      {!loginDisponivel && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Para criar logins da equipe, configure{" "}
          <code className="text-amber-100">SUPABASE_SERVICE_ROLE_KEY</code> no{" "}
          <code className="text-amber-100">.env.local</code> (Supabase → Settings → API).
        </div>
      )}

      {sucessoLogin && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          {sucessoLogin}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-at-muted">
          <Users className="h-4 w-4 shrink-0 text-at-link" />
          <span>
            {colaboradoresAtivos} de {limiteColaboradores} colaboradores
          </span>
          <span className="text-at-soft hidden sm:inline">·</span>
          <span className="text-xs text-at-muted">Admin não conta no limite</span>
          {!podeAdicionar && (
            <Link href="/planos" className="text-primary-neon hover:underline text-xs">
              Upgrade
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!podeAdicionar || !podeGerenciarEquipe}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          Adicionar membro
        </button>
      </div>

      {!podeAdicionar && (
        <p className="text-sm text-amber-400/90">
          Limite de colaboradores atingido. Faça upgrade em{" "}
          <Link href="/planos" className="underline">
            Planos
          </Link>{" "}
          para adicionar mais gerentes e operadores.
        </p>
      )}

      {msg && !showForm && !loginMembroId && (
        <p className="text-sm text-red-400 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          {msg}
        </p>
      )}

      {loginMembro && loginDisponivel && podeGerenciarEquipe && (
        <form onSubmit={handleCriarLogin} className="glass-card p-5 space-y-4 border border-primary-neon/20">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary-neon" />
            Criar login — {loginMembro.nome}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="E-mail *"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
            <FormSelect
              label="Como criar acesso"
              value={loginModo}
              onChange={(e) => setLoginModo(e.target.value as ModoLogin)}
              options={[
                { value: "senha", label: "Definir senha agora" },
                { value: "convite", label: "Enviar convite por e-mail" },
              ]}
            />
            {loginModo === "senha" && (
              <FormInput
                label="Senha inicial *"
                type="password"
                value={loginSenha}
                onChange={(e) => setLoginSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                hint="Repasse esta senha ao membro"
              />
            )}
          </div>
          {msg && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 whitespace-pre-wrap">
              {msg}
            </div>
          )}
          {apiDebug && (
            <details
              open
              className="rounded-lg border border-amber-500/40 bg-amber-950/40 p-3 text-xs text-amber-100"
            >
              <summary className="cursor-pointer font-sans text-sm font-medium text-amber-300">
                Debug — {apiDebug.label} (HTTP {apiDebug.status})
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                {JSON.stringify(apiDebug, null, 2)}
              </pre>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Criar login
            </button>
            <button
              type="button"
              onClick={closeLoginModal}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-at-primary/85"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {showForm && podeGerenciarEquipe && (
        <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {editingId ? "Editar membro" : "Novo membro da equipe"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Nome *"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Nome completo"
              required
            />
            <FormSelect
              label="Função *"
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as UserRole;
                setForm((f) => ({ ...f, role }));
                if (!permissoesPersonalizado) {
                  setPermissoesMatriz(permissoesPadraoRole(role));
                }
              }}
              options={
                editingAdmin
                  ? [{ value: "admin", label: labelRole("admin") }]
                  : roleOptions
              }
              disabled={editingAdmin}
            />
            <FormInput
              label="WhatsApp"
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              placeholder="(11) 99999-9999"
            />
            <FormInput
              label={!editingId && form.criar_login ? "E-mail *" : "E-mail"}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@exemplo.com"
              hint={
                !editingId && form.criar_login
                  ? "Usado para entrar no OperaRoute"
                  : "Contato do membro"
              }
            />
            <FormInput
              label="Comissão (%)"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={form.comissao_percentual}
              onChange={(e) =>
                setForm((f) => ({ ...f, comissao_percentual: e.target.value }))
              }
              hint="% do que sobrou livre na coleta (depois da comissão do ponto e do brinde)"
            />
            <FormSelect
              label="Status"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as "ativo" | "inativo",
                }))
              }
              options={[
                { value: "ativo", label: "Ativo" },
                { value: "inativo", label: "Inativo" },
              ]}
              disabled={editingAdmin}
            />
          </div>

          {!editingAdmin && podeGerenciarEquipe && (
            <PermissoesMatrix
              role={form.role}
              value={permissoesMatriz}
              onChange={setPermissoesMatriz}
              personalizado={permissoesPersonalizado}
              onPersonalizadoChange={setPermissoesPersonalizado}
            />
          )}

          {!editingId && loginDisponivel && !editingAdmin && (
            <div className="rounded-lg border border-at-soft bg-slate-900/50 p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-at-primary/85 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.criar_login}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, criar_login: e.target.checked }))
                  }
                  className="rounded border-slate-600"
                />
                Criar login de acesso ao sistema
              </label>
              {form.criar_login && (
                <div className="grid gap-4 sm:grid-cols-2 pt-1">
                  <FormSelect
                    label="Tipo de acesso"
                    value={form.modo_login}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        modo_login: e.target.value as ModoLogin,
                      }))
                    }
                    options={[
                      { value: "senha", label: "Definir senha agora" },
                      { value: "convite", label: "Enviar convite por e-mail" },
                    ]}
                  />
                  {form.modo_login === "senha" && (
                    <FormInput
                      label="Senha inicial *"
                      type="password"
                      value={form.senha}
                      onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      hint="O membro entra em /login com e-mail e esta senha"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {editingId && editingMembro && !editingMembro.user_id && !editingAdmin && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
              <p className="text-sm text-amber-200/90">
                Este membro ainda não tem login.
                {loginDisponivel
                  ? " Salve os dados e depois clique em «Criar login» no card, ou use o botão abaixo."
                  : " Configure SUPABASE_SERVICE_ROLE_KEY no .env.local e reinicie o servidor."}
              </p>
              {loginDisponivel && (
                <button
                  type="button"
                  onClick={() => {
                    closeForm();
                    openLoginModal(editingMembro);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary-neon/40 px-3 py-2 text-sm font-medium text-primary-neon hover:bg-primary-neon/10"
                >
                  <LogIn className="h-4 w-4" />
                  Criar login para {editingMembro.nome}
                </button>
              )}
            </div>
          )}

          {msg && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {msg}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50"
            >
              {editingId ? "Salvar alterações" : "Adicionar à equipe"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-at-primary/85 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {initialMembros.length === 0 && !showForm ? (
        <EmptyState
          title="Sem membros na equipe"
          description="Adicione gerentes e operadores com login para acessarem o sistema."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initialMembros.map((membro) => (
            <article
              key={membro.id}
              className={cn(
                "glass-card p-4 space-y-3",
                membro.status === "inativo" && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white truncate">{membro.nome}</p>
                  <span
                    className={cn(
                      "mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                      roleBadgeClass(membro.role)
                    )}
                  >
                    <RoleIcon role={membro.role} />
                    {labelRole(membro.role)}
                  </span>
                </div>
                {membro.role !== "admin" && podeGerenciarEquipe ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(membro)}
                      className="rounded-lg p-2 text-at-muted hover:bg-slate-800 hover:text-white"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(membro)}
                      className="rounded-lg p-2 text-at-muted hover:bg-red-500/10 hover:text-red-400"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : podeGerenciarEquipe ? (
                  <button
                    type="button"
                    onClick={() => openEdit(membro)}
                    className="rounded-lg p-2 text-at-muted hover:bg-slate-800 hover:text-white shrink-0"
                    title="Editar contato"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="space-y-1.5 text-sm text-at-muted">
                {membro.whatsapp && (
                  <p className="flex items-center gap-2 truncate">
                    <MessageCircle className="h-3.5 w-3.5 shrink-0 text-at-muted" />
                    {membro.whatsapp}
                  </p>
                )}
                {membro.email && (
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-at-muted" />
                    {membro.email}
                  </p>
                )}
                {membro.comissao_percentual > 0 && (
                  <p className="text-xs text-at-muted">
                    Comissão: {membro.comissao_percentual}% após brindes
                  </p>
                )}
                {membro.status === "inativo" && (
                  <p className="text-xs text-at-muted">Inativo</p>
                )}
                {membro.user_id ? (
                  <p className="text-xs text-at-money-pos flex items-center gap-1">
                    <LogIn className="h-3 w-3" />
                    Login ativo
                  </p>
                ) : membro.role !== "admin" ? (
                  <p className="text-xs text-amber-400/90">Sem login vinculado</p>
                ) : null}
              </div>

              {membro.role !== "admin" && loginDisponivel && podeGerenciarEquipe && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {!membro.user_id && (
                    <button
                      type="button"
                      onClick={() => openLoginModal(membro)}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary-neon/30 px-2.5 py-1.5 text-xs font-medium text-primary-neon hover:bg-primary-neon/10"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      Criar login
                    </button>
                  )}
                  {membro.user_id && (
                    <button
                      type="button"
                      onClick={() => handleRedefinirSenha(membro)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-at-muted hover:text-white"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Nova senha
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

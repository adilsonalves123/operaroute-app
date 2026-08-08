import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione no .env.local (Dashboard Supabase → Settings → API)."
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isAdminConfigured(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && key && key.length > 20);
}

function adminAuthHeaders(): Record<string, string> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    "Content-Type": "application/json",
  };
}

/** Busca usuário no Auth pelo e-mail (listUsers + fallback REST). */
export async function getAuthUserIdByEmail(
  email: string,
  debug?: string[]
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const admin = createAdminClient();

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      debug?.push(
        `auth.listUsers p${page}: ${error.name ?? "erro"} — ${error.message || "sem mensagem"} (status ${error.status ?? "?"})`
      );
      break;
    }
    if (!data.users.length) break;

    const found = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (found?.id) return found.id;

    if (data.users.length < 200) break;
  }

  const headers = adminAuthHeaders();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!headers || !url) return null;

  try {
    for (let page = 1; page <= 5; page++) {
      const res = await fetch(
        `${url}/auth/v1/admin/users?page=${page}&per_page=200`,
        { headers, cache: "no-store" }
      );
      if (!res.ok) {
        debug?.push(`auth.rest.list p${page}: HTTP ${res.status}`);
        break;
      }
      const json = (await res.json()) as { users?: { id: string; email?: string }[] };
      const found = json.users?.find((u) => u.email?.toLowerCase() === normalized);
      if (found?.id) {
        debug?.push(`auth.rest.list encontrou userId=${found.id}`);
        return found.id;
      }
      if (!json.users?.length || json.users.length < 200) break;
    }
  } catch (err) {
    debug?.push(`auth.rest.list exceção: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

export type AuthAdminCreateResult =
  | { ok: true; userId: string; raw?: unknown }
  | { ok: false; status: number; message: string; code?: string; raw?: unknown };

/** Cria usuário via REST (mensagens de erro mais claras que o client JS). */
export async function criarUsuarioAuthAdmin(input: {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
}): Promise<AuthAdminCreateResult> {
  const headers = adminAuthHeaders();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!headers || !url) {
    return { ok: false, status: 503, message: "Admin Auth não configurado." };
  }

  try {
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        email_confirm: true,
        user_metadata: input.metadata ?? {},
      }),
    });

    const text = await res.text();
    let raw: unknown = text;
    try {
      raw = text ? JSON.parse(text) : null;
    } catch {
      // mantém texto bruto
    }

    if (res.ok) {
      const userId = (raw as { id?: string })?.id;
      if (!userId) {
        return {
          ok: false,
          status: 500,
          message: "Usuário criado, mas ID não retornado pelo Auth.",
          raw,
        };
      }
      return { ok: true, userId, raw };
    }

    const body = raw as {
      msg?: string;
      message?: string;
      error_code?: string;
      code?: string;
      error?: string;
    };
    const message =
      body.msg ||
      body.message ||
      body.error ||
      (typeof raw === "string" && raw.trim() ? raw : "") ||
      `HTTP ${res.status} ao criar usuário no Auth`;

    return {
      ok: false,
      status: res.status,
      message,
      code: body.error_code ?? body.code,
      raw,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "Falha de rede ao chamar Supabase Auth.",
    };
  }
}

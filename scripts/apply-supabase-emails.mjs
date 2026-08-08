#! /usr/bin/env node
/**
 * Aplica templates de e-mail Auth (PT-BR / OperaRoute) no projeto Supabase.
 *
 * Uso:
 *   set SUPABASE_ACCESS_TOKEN=sbp_...
 *   set SUPABASE_PROJECT_REF=xxxxx
 *   node scripts/apply-supabase-emails.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TEMPLATES_DIR = path.join(ROOT, "supabase", "email-templates");

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8");
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;

  if (!token || !projectRef) {
    console.error(
      "Faltam SUPABASE_ACCESS_TOKEN e/ou SUPABASE_PROJECT_REF.\n" +
        "Crie o token em https://supabase.com/dashboard/account/tokens"
    );
    process.exit(1);
  }

  const payload = {
    mailer_subjects_confirmation: "Confirme seu e-mail — OperaRoute",
    mailer_templates_confirmation_content: readTemplate("confirmation.html"),
    mailer_subjects_magic_link: "Seu link de acesso — OperaRoute",
    mailer_templates_magic_link_content: readTemplate("magic_link.html"),
    mailer_subjects_recovery: "Redefinir senha — OperaRoute",
    mailer_templates_recovery_content: readTemplate("recovery.html"),
    mailer_subjects_email_change: "Confirme o novo e-mail — OperaRoute",
    mailer_templates_email_change_content: readTemplate("email_change.html"),
    mailer_subjects_invite: "Convite para o OperaRoute",
    mailer_templates_invite_content: readTemplate("magic_link.html"),
  };

  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    payload.external_email_enabled = true;
    payload.smtp_host = smtpHost;
    payload.smtp_port = String(process.env.SMTP_PORT || "587");
    payload.smtp_user = process.env.SMTP_USER || "";
    payload.smtp_pass = process.env.SMTP_PASS || "";
    payload.smtp_admin_email =
      process.env.SMTP_ADMIN_EMAIL || "noreply@operaroute.com.br";
    payload.smtp_sender_name = process.env.SMTP_SENDER_NAME || "OperaRoute";
  }

  const url = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Falha ao aplicar templates:", res.status, text);
    process.exit(1);
  }

  console.log("Templates Auth aplicados com sucesso (português / OperaRoute).");
  if (smtpHost) {
    console.log("SMTP customizado também configurado. Remetente:", payload.smtp_sender_name);
  } else {
    console.log(
      "SMTP não informado: o conteúdo já fica em português, mas o remetente ainda pode aparecer como Supabase até configurar SMTP."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

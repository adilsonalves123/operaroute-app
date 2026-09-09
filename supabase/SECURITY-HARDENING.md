# Segurança — aplicar no Supabase

1. Abra o **Supabase SQL Editor** do projeto de produção.
2. Cole e rode o arquivo `supabase/security-hardening.sql` (inteiro).
3. Confirme que não houve erro (NOTIFY no final).

O app já:
- Carrega `/r/[token]` via service_role (como `/c/`)
- Não depende mais de SELECT anon na tabela de rascunhos
- Fotos continuam acessíveis por URL pública CDN; listagem REST aberta foi removida no SQL

## Variáveis Vercel (recomendado)

| Variável | Para quê |
|----------|----------|
| `DONO_SESSION_SECRET` | Cookie do painel dono (não usar service role) |
| `AFILIADO_SESSION_SECRET` | Cookie parceiro (opcional) |
| `MP_WEBHOOK_SECRET` | Assinatura do webhook Mercado Pago |
| `CRON_SECRET` | Só via `Authorization: Bearer` |

Sem `MP_WEBHOOK_SECRET`, o webhook continua aceitando (legado). Com o secret, rejeita assinatura inválida.

Sem `DONO_SESSION_SECRET`, ainda usa fallback na service role (legado).

import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { uploadFotoEstoque } from "@/lib/storage/coleta-fotos";
import { asUploadFile, readRequestFormData } from "@/lib/request-form-data";

type RouteCtx = { params: Promise<{ id: string }> };

function asImageFile(raw: FormDataEntryValue | null): File | null {
  const file = asUploadFile(raw);
  if (!file || file.size <= 0) return null;
  if (file instanceof File && file.name) return file;
  const type = file.type || "image/jpeg";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  return new File([file], `foto.${ext}`, { type });
}

export async function POST(request: Request, ctx: RouteCtx) {
  const { id: itemId } = await ctx.params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const empresaId = profile.empresa_id;

  const { data: item, error: itemErr } = await supabase
    .from("estoque")
    .select("id")
    .eq("id", itemId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (itemErr) {
    return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }
  if (!item) {
    return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  }

  let form;
  try {
    form = await readRequestFormData(request);
  } catch {
    return NextResponse.json({ error: "Formulário de foto inválido." }, { status: 400 });
  }

  const file = asImageFile(form.get("foto"));
  if (!file) {
    return NextResponse.json({ error: "Envie um arquivo de imagem." }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Foto muito grande (máx. 10 MB)." }, { status: 400 });
  }

  // Admin bypassa RLS do Storage (causa comum de “salvou o item, foto não”).
  const uploader = isAdminConfigured() ? createAdminClient() : supabase;

  try {
    const fotoUrl = await uploadFotoEstoque(uploader, empresaId, itemId, file);

    const { data: updated, error: updateErr } = await uploader
      .from("estoque")
      .update({ foto_url: fotoUrl })
      .eq("id", itemId)
      .eq("empresa_id", empresaId)
      .select("id, foto_url")
      .maybeSingle();

    if (updateErr) {
      const msg = updateErr.message ?? "";
      if (msg.includes("foto_url") || msg.includes("schema cache")) {
        return NextResponse.json(
          {
            error:
              "Coluna foto_url ausente em estoque. Confirme o schema ou rode o SQL do estoque no Supabase.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (!updated?.foto_url) {
      return NextResponse.json(
        {
          error:
            "Foto enviada, mas não gravou no item (RLS/update). Rode supabase/fix-permissions.sql ou configure SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, foto_url: updated.foto_url });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Falha ao enviar foto.";
    const message = /mime type|not supported|avif/i.test(raw)
      ? "Formato de imagem não suportado. Use JPG, PNG ou WebP (o app agora converte AVIF automaticamente — atualize a página e tente de novo)."
      : raw;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

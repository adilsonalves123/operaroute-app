import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { uploadFotoProdutoConsignado } from "@/lib/storage/coleta-fotos";
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
  const { id: produtoId } = await ctx.params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const empresaId = profile.empresa_id;

  const { data: item, error: itemErr } = await supabase
    .from("produtos_consignados")
    .select("id")
    .eq("id", produtoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (itemErr) {
    return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }
  if (!item) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }

  let form;
  try {
    form = await readRequestFormData(request);
  } catch {
    return NextResponse.json({ error: "Formulário de foto inválido." }, { status: 400 });
  }

  const file = asImageFile(form.get("foto"));
  if (!file) {
    return NextResponse.json(
      {
        error:
          "Nenhuma imagem chegou ao servidor. No tablet, use Câmera ou Galeria e tente de novo.",
      },
      { status: 400 }
    );
  }

  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Foto muito grande (máx. 12 MB). Tire de novo ou escolha uma menor." },
      { status: 400 }
    );
  }

  const uploader = isAdminConfigured() ? createAdminClient() : supabase;

  try {
    const fotoUrl = await uploadFotoProdutoConsignado(uploader, empresaId, produtoId, file);

    const { data: updated, error: updateErr } = await uploader
      .from("produtos_consignados")
      .update({ foto_url: fotoUrl })
      .eq("id", produtoId)
      .eq("empresa_id", empresaId)
      .select("id, foto_url")
      .maybeSingle();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (!updated?.foto_url) {
      return NextResponse.json(
        {
          error:
            "Foto enviada, mas não gravou no produto. Verifique permissões ou SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, foto_url: updated.foto_url });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Falha ao enviar foto.";
    const message = /mime type|not supported|avif/i.test(raw)
      ? "Formato de imagem não suportado. Use JPG, PNG ou WebP."
      : raw;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

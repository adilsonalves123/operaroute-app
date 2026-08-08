import { redirect } from "next/navigation";

/** Certificados pausados — conteúdo agora vive na Universidade. */
export default function CertificadosPage() {
  redirect("/universidade");
}

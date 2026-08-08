import { redirect } from "next/navigation";

/** Antigo painel misturado ao app dos clientes — agora é /dono */
export default function PlataformaRedirect() {
  redirect("/dono");
}

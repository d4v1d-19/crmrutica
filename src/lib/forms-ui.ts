import { toast } from "sonner";

export function publicLink(slug: string) {
  return `${window.location.origin}/f/${slug}`;
}

export async function copyLink(slug: string) {
  try {
    await navigator.clipboard.writeText(publicLink(slug));
    toast.success("Link copiado");
  } catch {
    toast.error("No se pudo copiar el link");
  }
}

export const EMAIL_ESTADOS: Record<string, string> = {
  pendiente: "Pendiente",
  enviado: "Aviso enviado",
  sin_configurar: "Correo sin configurar",
  sin_destinatario: "Sin correo de aviso",
  error: "Error al enviar",
};

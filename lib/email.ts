import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER ?? "",
    pass: process.env.EMAIL_PASS ?? "", // Senha de app do Google (não a senha normal)
  },
});

export async function enviarEmail(para: string, assunto: string, html: string): Promise<boolean> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("[Email] EMAIL_USER ou EMAIL_PASS não configurados");
    return false;
  }
  try {
    await transporter.sendMail({
      from: `"Galeria Contourline" <${process.env.EMAIL_USER}>`,
      to: para,
      subject: assunto,
      html,
    });
    return true;
  } catch (e) {
    console.error("[Email] Erro ao enviar:", e);
    return false;
  }
}

export function emailEncontrado(nomeEvento: string, link: string, thumbUrl?: string): string {
  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#EFF5FF;font-family:Inter,sans-serif;">
    <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(13,43,78,0.10);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0D2B4E,#2E7DD1);padding:32px 32px 24px;text-align:center;">
        <img src="${process.env.NEXTAUTH_URL}/logos/logo.png" alt="Contourline" height="36" style="margin-bottom:16px;opacity:0.95" />
        <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 8px;">Acho que é você! 🤔</h1>
        <p style="color:rgba(255,255,255,0.75);font-size:14px;margin:0;">Possíveis fotos suas no evento <strong style="color:#fff">${nomeEvento}</strong> estão prontas pra você confirmar</p>
      </div>

      <!-- Thumb -->
      ${thumbUrl ? `
      <div style="text-align:center;padding:24px 32px 0;">
        <img src="${thumbUrl}" alt="Sua foto" style="width:120px;height:120px;border-radius:16px;object-fit:cover;border:3px solid #2E7DD1;box-shadow:0 4px 16px rgba(46,125,209,0.25);" />
      </div>` : ""}

      <!-- Body -->
      <div style="padding:24px 32px 32px;">
        <p style="color:#0D2B4E;font-size:15px;line-height:1.6;margin:0 0 16px;">
          Nossa IA acha que te encontrou nas fotos do evento <strong>${nomeEvento}</strong>.
          Clique no botão abaixo pra conferir!
        </p>

        <div style="background:#fff8e1;border:1px solid #ffd54f;border-radius:12px;padding:12px 16px;margin-bottom:24px;">
          <p style="color:#7a5800;font-size:12px;line-height:1.5;margin:0;">
            <strong>⚠ Lembrete:</strong> a IA pode confundir rostos parecidos ou com iluminação/ângulo diferentes da sua selfie.
            Marque só as fotos que realmente são suas usando o botão <em>"São minhas"</em>.
          </p>
        </div>

        <div style="text-align:center;margin-bottom:24px;">
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#2E7DD1,#1A4A80);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none;box-shadow:0 4px 16px rgba(46,125,209,0.4);">
            📸 Conferir as fotos
          </a>
        </div>

        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
          O link expira em 7 dias. Se não pediu este email, pode ignorá-lo.
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f8faff;border-top:1px solid #e8f0fe;padding:16px 32px;text-align:center;">
        <p style="color:#9ca3af;font-size:11px;margin:0;">
          © Contourline · Galeria de eventos
        </p>
      </div>
    </div>
  </body>
  </html>`;
}

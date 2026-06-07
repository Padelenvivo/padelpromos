// Genera y envía la newsletter semanal con los próximos torneos publicados en la agenda.
// Usa Brevo (antes Sendinblue) — https://www.brevo.com — vía su API de campañas de email.
// Pensado para ser invocado automáticamente por un Cron Job de Vercel (ver vercel.json),
// pero también puede llamarse a mano para probarlo.
//
// Variables de entorno necesarias en Vercel:
//   BREVO_API_KEY     → clave API de Brevo
//   BREVO_LIST_ID     → ID numérico de la lista de contactos a la que enviar
//   BREVO_SENDER      → email remitente verificado en Brevo (Senders & IP → Senders),
//                       por ejemplo: newsletter@padelpromos.es
//   CRON_SECRET       → cadena secreta cualquiera que tú elijas, para que solo Vercel Cron
//                       (o tú mismo a mano con esa clave) puedan disparar el envío.
//                       Vercel añade automáticamente la cabecera "Authorization: Bearer <CRON_SECRET>"
//                       a las llamadas de Cron Jobs cuando defines esta variable.
//
// Si quieres probarlo manualmente: GET /api/newsletter-semanal?secret=TU_CRON_SECRET

const SITE_URL = 'https://www.padelpromos.es';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fmtFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

function rangoFechas(inicio, fin) {
  if (fin && fin !== inicio) return `${fmtFecha(inicio)} – ${fmtFecha(fin)}`;
  return fmtFecha(inicio);
}

function construirHtml(torneos) {
  const filas = torneos.map(t => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #e7f0ea;">
        <div style="font-size:15px;font-weight:600;color:#0f1a14;margin-bottom:3px;">${t.torneo}</div>
        <div style="font-size:13px;color:#4a5e54;margin-bottom:6px;">${t.club} · ${t.ciudad}</div>
        <div style="font-size:13px;color:#1D9E75;font-weight:600;">${rangoFechas(t.fecha_inicio, t.fecha_fin)}</div>
        ${t.enlace ? `<a href="${t.enlace}" style="display:inline-block;margin-top:8px;font-size:13px;color:#0F6E56;text-decoration:none;border:1px solid #9FE1CB;border-radius:8px;padding:7px 14px;">Ver inscripción →</a>` : ''}
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f5faf7;font-family:'DM Sans', Arial, sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="text-align:center;margin-bottom:28px;">
        <span style="font-size:18px;font-weight:600;color:#0f1a14;">Padel<span style="color:#1D9E75;">Promos</span></span>
      </div>
      <div style="background:#ffffff;border:1px solid #d8ece2;border-radius:14px;padding:30px 28px;">
        <h1 style="font-size:21px;font-weight:600;color:#0f1a14;margin:0 0 8px;">Los torneos de la próxima semana</h1>
        <p style="font-size:14px;color:#4a5e54;line-height:1.6;margin:0 0 18px;">Aquí tienes los torneos de pádel que arrancan en los próximos días. Pulsa en cada uno para ver los detalles e inscribirte.</p>
        <table style="width:100%;border-collapse:collapse;">
          ${filas}
        </table>
        <p style="font-size:13px;color:#8aa096;margin:22px 0 0;">¿Quieres ver todos los torneos publicados? <a href="${SITE_URL}/agenda.html" style="color:#0F6E56;">Visita la agenda completa →</a></p>
      </div>
      <p style="text-align:center;font-size:12px;color:#8aa096;margin:22px 0 0;">
        Recibes este correo porque te suscribiste en padelpromos.es.<br>
        {unsubscribe}
      </p>
    </div>
  </body>
</html>`;
}

export default async function handler(req, res) {
  // Seguridad: solo Vercel Cron (o nosotros a mano con la clave) puede disparar el envío.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization;
    const queryToken = req.query?.secret;
    const autorizado = auth === `Bearer ${cronSecret}` || queryToken === cronSecret;
    if (!autorizado) {
      return res.status(401).json({ error: 'No autorizado' });
    }
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = process.env.BREVO_LIST_ID;
  const sender = process.env.BREVO_SENDER;

  if (!apiKey || !listId || !sender) {
    return res.status(500).json({
      error: 'La newsletter todavía no está activada (faltan BREVO_API_KEY / BREVO_LIST_ID / BREVO_SENDER).'
    });
  }

  try {
    // 1) Leer los torneos publicados desde el propio sitio
    const torneosResp = await fetch(`${SITE_URL}/torneos.json`, { cache: 'no-store' });
    const torneosData = await torneosResp.json();

    const hoy = new Date();
    const enUnaSemana = new Date();
    enUnaSemana.setDate(hoy.getDate() + 7);

    const proximos = (torneosData.torneos || [])
      .filter(t => t.publicado !== false)
      .filter(t => {
        const inicio = new Date(t.fecha_inicio);
        return inicio >= hoy && inicio <= enUnaSemana;
      })
      .sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio));

    if (proximos.length === 0) {
      return res.status(200).json({ ok: true, enviado: false, motivo: 'No hay torneos en los próximos 7 días — no se envía newsletter esta semana.' });
    }

    const html = construirHtml(proximos);
    const asunto = `🎾 ${proximos.length} torneo${proximos.length === 1 ? '' : 's'} de pádel esta semana`;

    // 2) Crear la campaña de email dirigida a la lista de Brevo
    const crearResp = await fetch('https://api.brevo.com/v3/emailCampaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        name: `Newsletter semanal — ${new Date().toISOString().slice(0, 10)}`,
        subject: asunto,
        sender: { name: 'PadelPromos', email: sender },
        htmlContent: html,
        recipients: { listIds: [Number(listId)] }
      })
    });

    if (!crearResp.ok) {
      const detail = await crearResp.text();
      return res.status(crearResp.status).json({ error: 'No se pudo crear la campaña', detail });
    }

    const campania = await crearResp.json();

    // 3) Enviarla ahora mismo
    const enviarResp = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campania.id}/sendNow`, {
      method: 'POST',
      headers: { 'api-key': apiKey }
    });

    if (!enviarResp.ok) {
      const detail = await enviarResp.text();
      return res.status(enviarResp.status).json({ error: 'No se pudo enviar la campaña', detail });
    }

    return res.status(200).json({ ok: true, enviado: true, torneos: proximos.length, campaignId: campania.id });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno', detail: error.message });
  }
}

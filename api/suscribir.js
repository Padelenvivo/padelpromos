// Da de alta un email en la lista de difusión de la newsletter semanal de PadelPromos.
//
// Requiere dos variables de entorno configuradas en Vercel (Project Settings → Environment Variables):
//   RESEND_API_KEY      → la clave API de tu cuenta de Resend (https://resend.com)
//   RESEND_AUDIENCE_ID  → el ID de la "Audience" (lista de contactos) creada en Resend
//
// Sin esas variables configuradas, este endpoint responde con un error claro mostrando qué falta,
// pero no rompe el resto del sitio.

function emailValido(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { email } = req.body || {};

  if (!emailValido(email)) {
    return res.status(400).json({ error: 'Introduce un email válido' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  if (!apiKey || !audienceId) {
    return res.status(500).json({
      error: 'La newsletter todavía no está activada en el servidor (faltan RESEND_API_KEY / RESEND_AUDIENCE_ID).'
    });
  }

  try {
    const resp = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        unsubscribed: false
      })
    });

    // Resend devuelve 409 si el contacto ya existe — lo tratamos como éxito (ya está suscrito).
    if (!resp.ok && resp.status !== 409) {
      const detail = await resp.text();
      return res.status(resp.status).json({ error: 'No se pudo completar la suscripción', detail });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno', detail: error.message });
  }
}

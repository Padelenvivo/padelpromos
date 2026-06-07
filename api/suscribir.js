// Da de alta un email en la lista de difusión de la newsletter semanal de PadelPromos.
// Usa Brevo (antes Sendinblue) — https://www.brevo.com — plan gratuito válido para esto.
//
// Requiere dos variables de entorno configuradas en Vercel (Project Settings → Environment Variables):
//   BREVO_API_KEY  → tu clave API de Brevo (Settings → SMTP & API → API Keys)
//   BREVO_LIST_ID  → el ID numérico de la lista de contactos donde se apuntan los suscriptores
//                    (Contacts → Lists → abre tu lista → el ID aparece en la URL o en "Settings")
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

  const apiKey = process.env.BREVO_API_KEY;
  const listId = process.env.BREVO_LIST_ID;

  if (!apiKey || !listId) {
    return res.status(500).json({
      error: 'La newsletter todavía no está activada en el servidor (faltan BREVO_API_KEY / BREVO_LIST_ID).'
    });
  }

  try {
    const resp = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        listIds: [Number(listId)],
        updateEnabled: true
      })
    });

    // Brevo devuelve 400 con código "duplicate_parameter" si el contacto ya existe
    // y "updateEnabled" no basta para añadirlo a la lista en algunos casos — lo tratamos como éxito.
    if (!resp.ok) {
      const detail = await resp.text();
      let codigo;
      try { codigo = JSON.parse(detail).code; } catch {}
      if (resp.status !== 400 || codigo !== 'duplicate_parameter') {
        return res.status(resp.status).json({ error: 'No se pudo completar la suscripción', detail });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno', detail: error.message });
  }
}

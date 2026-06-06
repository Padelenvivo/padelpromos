const LABELS = {
  instagram: 'Post Instagram',
  whatsapp: 'Mensaje WhatsApp',
  story: 'Story de apertura',
  plazas: 'ÚLtimas plazas',
  cuadros: 'Cuadros publicados',
  campeones: 'Post campeones',
  reel: 'Guion para reel',
  agradecimiento: 'Agradecimiento final'
};

function buildPrompt(data) {
  const contenidos = (data.contenidos || []).map(c => LABELS[c] || c).join(', ');
  return `Eres un experto en comunicación y marketing para clubs de pádel en España.
Genera el pack de comunicación para el siguiente torneo. Usa un tono ${data.tono} y escribe en español de España.

DATOS DEL TORNEO:
- Club: ${data.club}
- Torneo: ${data.torneo}
- Fecha: ${data.fecha}
- Categorías: ${data.categorias}
- Precio por pareja: ${data.precio}
${data.premios ? `- Premios: ${data.premios}` : ''}
${data.patrocinadores ? `- Patrocinadores: ${data.patrocinadores}` : ''}
${data.enlace ? `- Enlace de inscripción: ${data.enlace}` : ''}
${data.notas ? `- Info adicional: ${data.notas}` : ''}

Genera exactamente los siguientes contenidos: ${contenidos}.

Para CADA contenido, usa este formato EXACTO (sin markdown extra):
[TIPO: nombre_del_tipo]
texto del contenido aquí
[/TIPO]

Reglas:
- Post Instagram: máximo 200 caracteres + hashtags relevantes al final
- Mensaje WhatsApp: tono conversacional, máximo 150 palabras, sin hashtags
- Story de apertura: máximo 3 líneas muy cortas e impactantes
- ÚLtimas plazas: breve y urgente, máximo 100 caracteres
- Cuadros publicados: informativo y entusiasta
- Post campeones: emotivo y de reconocimiento
- Guion para reel: estructura en 3-4 escenas con descripción visual + texto en pantalla
- Agradecimiento final: cálido y de comunidad

No uses emojis en el texto, mantenlos al inicio o final si corresponde al tono.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const prompt = buildPrompt(req.body || {});
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({ error: 'Error en la API de Anthropic', detail });
    }
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return res.status(200).json({ content: text });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno', detail: error.message });
  }
}

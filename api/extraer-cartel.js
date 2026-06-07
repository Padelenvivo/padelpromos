const PROMPT = `Eres un asistente que analiza carteles/posters de torneos de pádel en español.
Mira la imagen adjunta y extrae la información del torneo que aparece en ella.

Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto adicional, sin \`\`\`) con esta forma exacta:
{
  "club": "",
  "torneo": "",
  "fecha_inicio": "",
  "fecha_fin": "",
  "categorias": "",
  "precio": "",
  "premios": "",
  "patrocinadores": "",
  "enlace": "",
  "notas": ""
}

Reglas:
- "fecha_inicio" y "fecha_fin" deben ir en formato AAAA-MM-DD si puedes deducir el año (si no aparece el año, usa el año actual). Si solo hay una fecha, deja "fecha_fin" vacío.
- "categorias" como lista separada por comas (ej: "Mixta B, Mixta C").
- "precio" tal y como aparece (ej: "25 €" o "25€/pareja").
- "enlace" solo si aparece una URL o enlace de inscripción visible en el cartel (Sportelia, Playtomic, etc.). Si no aparece, déjalo vacío.
- "notas" para cualquier información relevante adicional (horarios, normas, aforo, etc.) que no encaje en los otros campos.
- Si un dato no aparece en el cartel o no se puede leer con certeza, deja ese campo como cadena vacía "". No inventes datos.
- Responde SOLO con el JSON, nada más.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { image, mediaType } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'Falta la imagen' });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const type = allowed.includes(mediaType) ? mediaType : 'image/jpeg';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: type, data: image } },
            { type: 'text', text: PROMPT }
          ]
        }]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({ error: 'Error en la API de Anthropic', detail });
    }

    const data = await response.json();
    let text = (data.content?.[0]?.text || '').trim();

    // Limpiar posibles bloques de código markdown por si el modelo los añade
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ error: 'No se pudo interpretar la respuesta del modelo', detail: text });
    }

    return res.status(200).json({ data: parsed });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno', detail: error.message });
  }
}

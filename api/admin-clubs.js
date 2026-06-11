import { Octokit } from '@octokit/rest';

const ADMIN_KEY = process.env.ADMIN_KEY || 'padelpromos2025';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'Padelenvivo';
const REPO_NAME = 'padelpromos';
const FILE_PATH = 'data/clubs.json';

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
}

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  // GET - obtener todos los clubs
  if (req.method === 'GET') {
    try {
      const { data } = await octokit.repos.getContent({
        owner: REPO_OWNER, repo: REPO_NAME, path: FILE_PATH
      });
      const clubs = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      return res.status(200).json(clubs);
    } catch (e) {
      if (e.status === 404) return res.status(200).json({});
      return res.status(500).json({ error: 'Error leyendo clubs', detail: e.message });
    }
  }

  // POST - crear nuevo club
  if (req.method === 'POST') {
    const { token, club } = req.body;
    if (!token || !club || !club.nombre) {
      return res.status(400).json({ error: 'Token y nombre son obligatorios' });
    }
    try {
      let sha, clubs = {};
      try {
        const { data } = await octokit.repos.getContent({
          owner: REPO_OWNER, repo: REPO_NAME, path: FILE_PATH
        });
        sha = data.sha;
        clubs = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      if (clubs[token]) {
        return res.status(409).json({ error: 'El token ya existe' });
      }
      clubs[token] = { ...club, activo: true };
      const newContent = Buffer.from(JSON.stringify(clubs)).toString('base64');
      await octokit.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: FILE_PATH,
        message: 'Admin: añadir club ' + club.nombre,
        content: newContent,
        ...(sha ? { sha } : {})
      });
      return res.status(200).json({ ok: true, token });
    } catch (e) {
      return res.status(500).json({ error: 'Error guardando club', detail: e.message });
    }
  }

  // PATCH - activar/desactivar club
  if (req.method === 'PATCH') {
    const { token, activo } = req.body;
    if (!token || typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'Token y estado son obligatorios' });
    }
    try {
      const { data } = await octokit.repos.getContent({
        owner: REPO_OWNER, repo: REPO_NAME, path: FILE_PATH
      });
      const clubs = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      if (!clubs[token]) return res.status(404).json({ error: 'Club no encontrado' });
      clubs[token].activo = activo;
      const newContent = Buffer.from(JSON.stringify(clubs)).toString('base64');
      await octokit.repos.createOrUpdateFileContents({
        owner: REPO_OWNER, repo: REPO_NAME, path: FILE_PATH,
        message: 'Admin: ' + (activo ? 'activar' : 'desactivar') + ' club ' + token,
        content: newContent,
        sha: data.sha
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Error actualizando club', detail: e.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

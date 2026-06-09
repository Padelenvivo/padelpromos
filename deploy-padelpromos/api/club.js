import clubs from '../data/clubs.json' with {type:'json'};
export default function handler(req,res){const{token}=req.query;if(!token)return res.status(400).json({error:'Token requerido'});const club=clubs[token];if(!club)return res.status(404).json({error:'Club no encontrado'});if(!club.activo)return res.status(403).json({error:'Club inactivo'});return res.status(200).json(club);}

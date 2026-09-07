import express from 'express';
import { html } from './http.js';
import { parseSchools, parseRatio } from './parser.js';
const app = express();
const cache = new Map();
const pending = new Map();
function failure(res, error, scope) {
  const code = String(error.cause?.code || error.code || error.name || 'UPSTREAM_ERROR');
  console.error(`[${scope}]`, { code, message: error.message, cause: error.cause?.message });
  const detail = /TIMEOUT|Timeout/.test(code) ? '원본 사이트 응답 시간이 초과되었습니다.' : /UPSTREAM_HTTP_/.test(code) ? '원본 사이트가 요청을 거부했거나 오류를 반환했습니다.' : code === 'UPSTREAM_FORMAT' ? '원본 페이지에서 학교 목록 데이터를 찾을 수 없습니다.' : '원본 사이트에 연결하지 못했습니다.';
  res.status(502).json({ error: `${detail} 잠시 후 다시 시도해 주세요. (${code})` });
}
async function cached(key, ttl, fn) {
  const old = cache.get(key);
  if (old && Date.now()-old.time<ttl) return old.value;
  if (pending.has(key)) return pending.get(key);
  const task = fn().then(value=>{ cache.set(key,{time:Date.now(),value}); return value; }).finally(()=>pending.delete(key));
  pending.set(key,task); return task;
}
const schools = () => cached('schools', 3600000, async()=>parseSchools(await html('https://apply.jinhakapply.com/SmartRatio')));
app.get('/api/schools', async(req,res)=>{ try { res.json(await schools()); } catch (error) { failure(res, error, 'schools'); } });
app.get('/api/ratio/:id', async(req,res)=>{
  try {
    const school = (await schools()).find(s=>s.id===req.params.id);
    if (!school) return res.status(404).json({error:'학교 목록이 변경되었습니다. 다시 등록해 주세요.'});
    if (!/^https?:\/\//.test(school.url)) return res.status(404).json({error:'학교에서 경쟁률 링크를 아직 공개하지 않았습니다.'});
    const result = await cached(school.url, 60000, async()=>parseRatio(await html(school.url)));
    if (!result.rows.length) return res.status(422).json({error:'아직 공개된 표가 없거나 자동 조회를 지원하지 않는 형식입니다. 원문을 확인해 주세요.'});
    res.json({...result, school});
  } catch (error) { failure(res, error, 'ratio'); }
});
if (process.env.NODE_ENV === 'production') app.use(express.static('dist'));
else { const { createServer } = await import('vite'); const vite = await createServer({server:{middlewareMode:true},appType:'spa'}); app.use(vite.middlewares); }
const port = Number(process.env.PORT || 5173);
app.listen(port,'0.0.0.0',()=>console.log(`수시 경쟁률 http://localhost:${port}`));

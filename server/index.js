import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import iconv from 'iconv-lite';
import { parseSchools, parseRatio } from './parser.js';
const exec = promisify(execFile);
const app = express();
const cache = new Map();
const pending = new Map();
async function html(url) {
  // curl honors the host's proxy settings, including this workspace's network proxy.
  const { stdout } = await exec('curl', ['--fail','--location','--silent','--show-error','--max-time','25','--proto','=http,https','--proto-redir','=http,https', url], { encoding: 'buffer', maxBuffer: 8*1024*1024 });
  const head = stdout.subarray(0,4000).toString('ascii');
  return iconv.decode(stdout, /charset\s*=\s*["']?(euc-kr|ks_c_5601|cp949)/i.test(head) ? 'cp949' : 'utf8');
}
async function cached(key, ttl, fn) {
  const old = cache.get(key);
  if (old && Date.now()-old.time<ttl) return old.value;
  if (pending.has(key)) return pending.get(key);
  const task = fn().then(value=>{ cache.set(key,{time:Date.now(),value}); return value; }).finally(()=>pending.delete(key));
  pending.set(key,task); return task;
}
const schools = () => cached('schools', 3600000, async()=>parseSchools(await html('https://apply.jinhakapply.com/SmartRatio')));
app.get('/api/schools', async(req,res)=>{ try { res.json(await schools()); } catch { res.status(502).json({error:'학교 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}); } });
app.get('/api/ratio/:id', async(req,res)=>{
  try {
    const school = (await schools()).find(s=>s.id===req.params.id);
    if (!school) return res.status(404).json({error:'학교 목록이 변경되었습니다. 다시 등록해 주세요.'});
    if (!/^https?:\/\//.test(school.url)) return res.status(404).json({error:'학교에서 경쟁률 링크를 아직 공개하지 않았습니다.'});
    const result = await cached(school.url, 60000, async()=>parseRatio(await html(school.url)));
    if (!result.rows.length) return res.status(422).json({error:'아직 공개된 표가 없거나 자동 조회를 지원하지 않는 형식입니다. 원문을 확인해 주세요.'});
    res.json({...result, school});
  } catch { res.status(502).json({error:'학교 경쟁률을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}); }
});
if (process.env.NODE_ENV === 'production') app.use(express.static('dist'));
else { const { createServer } = await import('vite'); const vite = await createServer({server:{middlewareMode:true},appType:'spa'}); app.use(vite.middlewares); }
const port = Number(process.env.PORT || 5173);
app.listen(port,'127.0.0.1',()=>console.log(`수시 경쟁률 http://localhost:${port}`));

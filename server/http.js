import { fetch, EnvHttpProxyAgent } from 'undici';
import iconv from 'iconv-lite';
const dispatcher = new EnvHttpProxyAgent();
export async function html(url) {
  const response = await fetch(url, {
    dispatcher,
    signal: AbortSignal.timeout(25000),
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; AdmissionRatio/1.0)' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw Object.assign(new Error(`Upstream HTTP ${response.status}`), { code: `UPSTREAM_HTTP_${response.status}` });
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw Object.assign(new Error('Upstream response too large'), { code: 'UPSTREAM_TOO_LARGE' });
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const head = `${response.headers.get('content-type') || ''} ${buffer.subarray(0,4000).toString('ascii')}`;
  return iconv.decode(buffer, /charset\s*=\s*["']?(euc-kr|ks_c_5601|cp949)/i.test(head) ? 'cp949' : 'utf8');
}

import { load } from 'cheerio';
import { createHash } from 'node:crypto';
const clean = s => s.replace(/\s+/g, ' ').trim();
const id = s => createHash('sha256').update(s).digest('hex').slice(0, 20);
export function parseSchools(html) {
  const $ = load(html);
  let data;
  try {
    data = JSON.parse($('#hdnResultNow').val());
    if (!Array.isArray(data?.Columns) || !Array.isArray(data?.Rows)) throw new Error('Missing table');
  } catch {
    throw Object.assign(new Error('SmartRatio school data missing or invalid'), { code: 'UPSTREAM_FORMAT' });
  }
  return data.Rows.map(row => Object.fromEntries(data.Columns.map((c, i) => [c, row[i]])))
    .filter(s => s.CategoryName === '수시')
    .map(s => ({ id: id(`${s.SchoolYear}|${s.UnivName}|${s.CategoryDisplayName}`), name: s.UnivName, year: s.SchoolYear, category: s.CategoryDisplayName, url: (s.RatioLink || '').trim(), startsAt: s.ApplyFromTime, endsAt: s.ApplyToTime }))
    .sort((a,b) => a.name.localeCompare(b.name, 'ko'));
}
export function parseRatio(html) {
  const $ = load(html);
  $('script,style').remove();
  let heading = '';
  const rows = [];
  // Expand spans before matching columns: region and campus must remain part of identity.
  $('h2,h3,table').each((_, el) => {
    if (el.tagName !== 'table') { heading = clean($(el).text()).replace(/\s*경쟁[률율]\s*현황.*$/, ''); return; }
    const grid = [];
    $(el).find('tr').filter((_, tr) => $(tr).closest('table')[0] === el).each((r, tr) => {
      grid[r] ||= [];
      let col = 0;
      $(tr).children('th,td').each((_, cell) => {
        while (grid[r][col] !== undefined) col++;
        const value = clean($(cell).text());
        const rs = Math.min(200, Number($(cell).attr('rowspan')) || 1);
        const cs = Math.min(30, Number($(cell).attr('colspan')) || 1);
        for (let a=0;a<rs;a++) for (let b=0;b<cs;b++) { grid[r+a] ||= []; grid[r+a][col+b] = value; }
        col += cs;
      });
    });
    const hi = grid.findIndex(r => r.some(v => /모집\s*인원/.test(v)) && r.some(v => /모집단위|학과명|학부.*학과/.test(v)) && r.some(v => /경쟁[률율]/.test(v)));
    if (hi < 0 || !heading || /전형별|전체/.test(heading)) return;
    const headers = grid[hi];
    const quota = headers.findIndex(v=>/모집\s*인원/.test(v));
    const applicants = headers.findIndex(v=>/지원\s*(인원|자)/.test(v));
    const ratio = headers.findIndex(v=>/경쟁[률율]/.test(v));
    if (quota < 1 || applicants < 0 || ratio < 0) return;
    for (const r of grid.slice(hi+1)) {
      if (!r || r.slice(0,quota).some(v=>/^(총계|합계|소계)$/.test(v))) continue;
      const labels = [...new Set(r.slice(0,quota).filter(Boolean))];
      if (!labels.length || !/^[\d,.]+\s*:\s*1$/.test(r[ratio] || '')) continue;
      const department = labels.join(' / ');
      const number = v => /^[\d,]+$/.test(v || '') ? Number(v.replaceAll(',','')) : null;
      rows.push({ id: id(`${heading}|${department}`), admission: heading, department, quota: number(r[quota]), quotaText: r[quota], applicants: number(r[applicants]), ratio: r[ratio] });
    }
  });
  const text = clean($('body').text());
  const publishedAt = clean($('#RatioTime, #ID_DateStr').first().text()) || (text.match(/20\d{2}[-.년]\s*\d{1,2}[-.월]\s*\d{1,2}[^\n]{0,35}?(?:현황|기준)/)?.[0] ?? '발표 시각 미표시');
  const final = /최종\s*마감\s*현황입니다|최종\s*경쟁률\s*(입니다|현황)/.test(text);
  return { rows: [...new Map(rows.map(r=>[r.id,r])).values()], publishedAt, final, fetchedAt: new Date().toISOString() };
}

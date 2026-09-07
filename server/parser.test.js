import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRatio, parseSchools } from './parser.js';
test('expands merged department and region cells without mixing admissions',()=>{
 const html=`<body><p id="RatioTime">2026-09-07 오전 11:20 현황</p><h2>지역의사선발 전형 경쟁률 현황</h2><table><tr><th>모집단위</th><th>지역</th><th>모집인원</th><th>지원인원</th><th>경쟁률</th></tr><tr><td rowspan="2">의예과</td><td>서울</td><td>2</td><td>0</td><td>0.00 : 1</td></tr><tr><td>경기</td><td>3</td><td>6</td><td>2.00 : 1</td></tr><tr><td colspan="2">총계</td><td>5</td><td>6</td><td>1.20 : 1</td></tr></table></body>`;
 const r=parseRatio(html);assert.equal(r.rows.length,2);assert.equal(r.rows[1].department,'의예과 / 경기');assert.equal(r.rows[0].applicants,0);assert.notEqual(r.rows[0].id,r.rows[1].id);assert.equal(r.final,false);
});
test('handles repeated column spans and extra links after ratio',()=>{
 const r=parseRatio('<h3>일반전형 경쟁률 현황</h3><table><tr><th colspan="2">모집단위</th><th>모집<br>인원</th><th>지원인원</th><th>경쟁률</th><th>안내</th></tr><tr><td colspan="2">간호학과</td><td>1,000</td><td>2,000</td><td>2.00 : 1</td><td>보기</td></tr></table>');
 assert.equal(r.rows[0].department,'간호학과');assert.equal(r.rows[0].quota,1000);assert.equal(r.rows[0].applicants,2000);
});
test('selects only current early admission entries from named columns',()=>{
 const data={Columns:['UnivName','SchoolYear','CategoryName','CategoryDisplayName','RatioLink'],Rows:[['학교',2027,'수시','수시모집',' https://example.com '],['학교',2026,'정시','정시모집','']]};
 const result=parseSchools(`<input id="hdnResultNow" value='${JSON.stringify(data)}'>`);assert.equal(result.length,1);assert.equal(result[0].url,'https://example.com');
});

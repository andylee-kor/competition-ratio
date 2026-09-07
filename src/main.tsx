import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, BarChart3, Plus, RefreshCw, Trash2, GraduationCap, AlertCircle, ChevronDown } from 'lucide-react';
import './style.css';
type School = {id:string;name:string;year:number;category:string;url:string};
type Row = {id:string;admission:string;department:string;quota:number|null;quotaText:string;applicants:number|null;ratio:string};
type Result = {rows:Row[];publishedAt:string;fetchedAt:string;final:boolean};
type Entry = {key:string;school:School;row:Row};
const KEY = 'admission-ratio:watchlist:v1';
async function get<T,>(url:string):Promise<T> { const res=await fetch(url); const data=await res.json(); if(!res.ok) throw new Error(data.error || '조회에 실패했습니다.'); return data; }
function read():Entry[] { try { const value=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(value)?value.filter(e=>typeof e?.key==='string'&&typeof e?.school?.id==='string'&&typeof e?.row?.id==='string'&&typeof e?.row?.department==='string'):[]; } catch{return [];} }
function App(){
  const [entries,setEntries]=useState<Entry[]>(read);
  const [manageOpen,setManageOpen]=useState(()=>read().length===0);
  const [schools,setSchools]=useState<School[]>([]);
  const [schoolId,setSchoolId]=useState('');
  const [query,setQuery]=useState('');
  const [admission,setAdmission]=useState('');
  const [rowId,setRowId]=useState('');
  const [results,setResults]=useState<Record<string,Result>>({});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<Record<string,boolean>>({});
  const [schoolError,setSchoolError]=useState('');
  const [loadingSchools,setLoadingSchools]=useState(true);
  const [notice,setNotice]=useState('');
  const [auto,setAuto]=useState(true);
  const inflight=useRef(new Set<string>());
  const current=schools.find(s=>s.id===schoolId);
  const result=results[schoolId];
  const admissions=[...new Set(result?.rows.map(r=>r.admission)||[])];
  const choices=result?.rows.filter(r=>r.admission===admission)||[];
  async function loadSchools(){setLoadingSchools(true);setSchoolError('');try{setSchools(await get<School[]>('/api/schools'));}catch(e){setSchoolError((e as Error).message);}finally{setLoadingSchools(false);}}
  async function refresh(id:string){
    if(inflight.current.has(id))return;
    inflight.current.add(id);setBusy(b=>({...b,[id]:true}));
    try{const data=await get<Result>(`/api/ratio/${encodeURIComponent(id)}`);setResults(r=>({...r,[id]:data}));setErrors(e=>({...e,[id]:''}));}
    catch(e){setErrors(old=>({...old,[id]:(e as Error).message}));}
    finally{inflight.current.delete(id);setBusy(b=>({...b,[id]:false}));}
  }
  function refreshAll(){[...new Set(entries.map(e=>e.school.id))].forEach(refresh);}
  useEffect(()=>{void loadSchools();},[]);
  useEffect(()=>{if(schoolId)void refresh(schoolId);},[schoolId]);
  useEffect(()=>{entries.forEach(e=>{if(!results[e.school.id]&&!errors[e.school.id])void refresh(e.school.id);});},[entries]);
  useEffect(()=>{if(!auto)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')refreshAll();},300000);return()=>clearInterval(timer);},[entries,auto]);
  useEffect(()=>{const sync=(e:StorageEvent)=>{if(e.key===KEY)setEntries(read());};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  function save(next:Entry[]){try{localStorage.setItem(KEY,JSON.stringify(next));setEntries(next);return true;}catch{setNotice('브라우저 저장 공간을 사용할 수 없습니다. 저장 설정을 확인해 주세요.');return false;}}
  function add(e:React.FormEvent){e.preventDefault();const row=choices.find(r=>r.id===rowId);if(!row||!current)return;const key=`${current.id}:${row.id}`;if(entries.some(e=>e.key===key)){setNotice('이미 등록된 지원 항목입니다.');return;}if(save([...entries,{key,school:current,row}]))setNotice('지원 목록에 등록했습니다.');}
  const years=[...new Set(schools.map(s=>s.year))].join(', ');
  const anyBusy=entries.some(e=>busy[e.school.id]);
  const sortedEntries=[...entries].sort((a,b)=>a.school.name.localeCompare(b.school.name,'ko'));
  return <><header><div className="brand"><span className="brand-icon"><BarChart3 size={23}/></span><span>수시 경쟁률</span></div><a href="https://apply.jinhakapply.com/SmartRatio" target="_blank" rel="noreferrer">진학어플라이 <ArrowUpRight size={15}/></a></header>
  <main><div className="page-heading"><div><p className="eyebrow">ADMISSION WATCH</p><h1>나의 지원 현황</h1><p className="muted">{years?`${years}학년도 수시모집`:'수시모집'}<span className="dot">·</span>등록한 지원 {entries.length}건</p></div><span className="year-badge"><GraduationCap size={19}/> 수시</span></div>
  <section className="manage" aria-labelledby="manage-title"><button className="manage-toggle" aria-expanded={manageOpen} aria-controls="manage-content" onClick={()=>setManageOpen(open=>!open)}><h2 id="manage-title">지원 목록 관리</h2><span className="manage-summary">{entries.length}개 등록<ChevronDown size={18} className={manageOpen?'expanded':''}/></span></button>
  <div id="manage-content" hidden={!manageOpen}>
  {schoolError&&<div className="error" role="alert">{schoolError}<button onClick={loadSchools}>다시 시도</button></div>}
  <form onSubmit={add}><div className="school-field"><label htmlFor="search">학교</label><input id="search" placeholder="학교명 검색" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="학교 선택" value={schoolId} onChange={e=>{setSchoolId(e.target.value);setAdmission('');setRowId('');setNotice('');}}><option value="">{loadingSchools?'학교 목록 불러오는 중…':'학교 선택'}</option>{schools.filter(s=>s.name.includes(query)).map(s=><option key={s.id} value={s.id}>{s.name} · {s.category}</option>)}</select></div>
  <div><label htmlFor="admission">전형</label><select id="admission" disabled={!result||busy[schoolId]} value={admission} onChange={e=>{setAdmission(e.target.value);setRowId('');}}><option value="">{busy[schoolId]?'전형 불러오는 중…':'전형 선택'}</option>{admissions.map(a=><option key={a}>{a}</option>)}</select></div>
  <div><label htmlFor="department">학과 · 모집단위</label><select id="department" disabled={!admission} value={rowId} onChange={e=>setRowId(e.target.value)}><option value="">모집단위 선택</option>{choices.map(r=><option key={r.id} value={r.id}>{r.department}</option>)}</select></div><button className="primary add" disabled={!rowId||busy[schoolId]} type="submit"><Plus size={17}/> 등록</button></form>
  {errors[schoolId]&&<div className="error" role="alert"><AlertCircle size={17}/>{errors[schoolId]}<button onClick={()=>refresh(schoolId)}>재시도</button>{current?.url&&<a href={current.url} target="_blank" rel="noreferrer">원문 보기</a>}</div>}
  <p className="notice" role="status">{notice}</p>
  {entries.length>0&&<ul className="registered">{entries.map(e=><li key={e.key}><span className="school-name">{e.school.name}</span><span className="entry-detail">{e.row.admission}<span className="dot">·</span>{e.row.department}</span><button className="icon-button" aria-label={`${e.school.name} ${e.row.department} 삭제`} title="지원 항목 삭제" onClick={()=>{if(save(entries.filter(x=>x.key!==e.key)))setNotice('지원 목록에서 삭제했습니다.');}}><Trash2 size={17}/></button></li>)}</ul>}
  </div></section>
  <section className="ratios" aria-labelledby="ratio-title"><div className="section-heading"><div><p className="eyebrow">MY WATCHLIST</p><h2 id="ratio-title">경쟁률 현황 <span className="count">{entries.length}</span></h2></div><div className="actions"><label className="toggle"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>5분마다 갱신</label><button className="refresh" disabled={anyBusy||!entries.length} onClick={refreshAll}><RefreshCw size={16} className={anyBusy?'spin':''}/>{anyBusy?'조회 중':'새로고침'}</button></div></div>
  {!entries.length?<div className="empty"><GraduationCap size={42} strokeWidth={1.3}/><h3>등록한 지원 항목이 없습니다</h3></div>:<div className="ratio-grid">{sortedEntries.map(e=>{
    const data=results[e.school.id];
    const row=data?.rows.find(r=>r.id===e.row.id);
    const error=errors[e.school.id]||(data&&!row?'모집단위가 변경되었거나 공개되지 않았습니다.':'');
    return <article className="ratio-card" key={e.key} aria-label={`${e.school.name} ${e.row.department}`}>
      <div className="card-heading"><h3>{e.school.name}</h3>{/^https?:\/\//.test(e.school.url)&&<a className="icon-button" href={e.school.url} target="_blank" rel="noreferrer" title="경쟁률 원문" aria-label={`${e.school.name} 경쟁률 원문`}><ArrowUpRight size={17}/></a>}</div>
      <p className="card-department">{e.row.department}</p><p className="card-admission">{e.row.admission}</p>
      <div className="card-numbers"><strong className="ratio">{row?.ratio??'—'}</strong><span className={`status ${error?'warning':data?.final?'final':''}`}>{error?'조회 확인 필요':busy[e.school.id]?'조회 중':data?.final?'최종':'최신 공개'}</span></div>
      <dl className="card-counts"><div><dt>모집</dt><dd>{row?.quotaText??'—'}명</dd></div><div><dt>지원</dt><dd>{row?.applicants?.toLocaleString()??'—'}명</dd></div></dl>
      <div className="card-time"><span>{data?.publishedAt||'발표 시각 확인 중'}</span>{data&&<span>조회 {new Date(data.fetchedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span>}</div>
      {error&&<p className="error-text">{error}{row?' (이전 조회 값)':''}</p>}
    </article>;
  })}</div>}
  <div className="source-note"><span>출처: 진학어플라이 · 유웨이 · 각 대학</span><span>학교의 공개 시점 기준</span></div></section>
  <footer><span>수시 경쟁률</span><span>지원 목록은 이 브라우저에 저장됩니다.</span></footer></main></>;
}
createRoot(document.getElementById('root')!).render(<App/>);

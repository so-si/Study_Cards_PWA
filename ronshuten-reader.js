/* Reading mode has a separate cache. Never edits quiz cards, ratings or pending events. */
(() => {
 'use strict';
 const KEY='studyCardsRonshutenV1';
 const names={draft:'未点検',reviewed:'編集済み・確認事項あり',verified:'典拠照合済み'};
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
 const button=(text,action)=>{const b=el('button',text,'btn secondary');b.type='button';b.onclick=action;return b;};
 const section=el('section');section.id='ronshutenReader';section.hidden=true;
 section.style.cssText='max-width:900px;margin:auto;padding:16px;overflow-wrap:anywhere';
 const home=document.getElementById('setup');
 let snapshot=null,filtered=[],currentKey=null,active=false;
 const notice=el('p','','status');notice.setAttribute('role','status');
 const controls=el('div',undefined,'card');
 controls.append(el('h2','編集済み論点集'),notice);
 const input=el('input');input.type='file';input.accept='.json,application/json';input.hidden=true;input.id='ronshutenImport';
 const search=el('input');search.type='search';search.placeholder='論点・規範・理由を検索';search.setAttribute('aria-label','論点集を検索');search.style.cssText='width:100%;padding:13px;font-size:17px;margin:12px 0';
 const subject=el('select');subject.setAttribute('aria-label','論点集の科目');subject.style.cssText='width:100%;padding:12px;font-size:17px';
 const unchecked=el('input');unchecked.type='checkbox';unchecked.id='ronshutenUnverified';
 const toggle=el('label');toggle.append(unchecked,document.createTextNode(' 未確認の原稿も表示する'));
 controls.append(button('オンラインで原稿を更新',refresh),button('原稿JSONを読み込む',()=>input.click()),input,subject,search,toggle);
 const list=el('div');list.id='ronshutenResults';
 const article=el('article',undefined,'card');article.id='ronshutenBody';article.hidden=true;
 section.append(button('← 学習画面へ',close),controls,list,article);
 (document.querySelector('.app')||document.body).append(section);
 const launch=button('編集済み論点集を読む',open);launch.id='openRonshuten';
 (home?.querySelector('.panel')||document.body).append(launch);
 search.oninput=subject.onchange=unchecked.onchange=()=>{currentKey=null;renderList();};
 function validate(data){
  if(!data||data.schemaVersion!==1||!Array.isArray(data.topics))throw new Error('対応する論点集JSONではありません。');
  const keys=new Set();
  const scalar=(v)=>typeof v==='string';
  const strings=(v)=>Array.isArray(v)&&v.every(scalar);
  for(const t of data.topics){
   if(!t||!scalar(t.key)||!t.key||keys.has(t.key)||!names[t.status]||!['subject','majorCategory','category','title','trigger','purpose','rule'].every(k=>scalar(t[k]))||!strings(t.sourceCardIds)||!strings(t.factors)||!strings(t.reviewNotes)||!strings(t.relatedTopics)||!Array.isArray(t.articles)||!Array.isArray(t.cases))throw new Error('原稿の構造に不備があります。');
   for(const a of t.articles)if(!a||!scalar(a.text)||!scalar(a.source))throw new Error('条文データに不備があります。');
   for(const c of t.cases)if(!c||!['name','holding','facts','source'].every(k=>scalar(c[k])))throw new Error('判例データに不備があります。');
   if(t.status==='verified'&&(!t.verifiedAt||t.reviewNotes.length||!t.sourceCardIds.length||t.cases.some(c=>c.verified!==true||!safeUrl(c.source))||t.articles.some(a=>a.verified!==true||!safeUrl(a.source))||!['rule','purpose','factors','cases','articles'].every(k=>t.reviewEvidence?.[k]?.reviewedAt&&t.reviewEvidence[k].sources?.length)))throw new Error('典拠照合済み原稿の検証情報に不備があります。');
   if(t.evaluationAxes&&(!strings(t.evaluationAxes.positive)||!strings(t.evaluationAxes.negative)))throw new Error('評価軸に不備があります。');
   keys.add(t.key);
  }
  return data;
 }
 function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
 function save(data){
  validate(data);
  // Quota failure preserves the previous snapshot on disk and active snapshot in memory.
  const payload=JSON.stringify({schemaVersion:1,topics:data.topics,summary:data.summary||{},savedAt:new Date().toISOString()});
  localStorage.setItem(KEY,payload);snapshot=JSON.parse(payload);populate();
 }
 function populate(){
  const selected=subject.value;subject.replaceChildren(el('option','全科目'));subject.firstChild.value='';
  for(const s of [...new Set((snapshot?.topics||[]).map(t=>t.subject))]){const o=el('option',s);o.value=s;subject.append(o);}
  subject.value=[...subject.options].some(x=>x.value===selected)?selected:'';
  notice.textContent=snapshot?`${snapshot.topics.length}論点を端末に保存済み。${snapshot.savedAt?new Date(snapshot.savedAt).toLocaleString('ja-JP'):''}`:'原稿を更新するか、JSONを読み込んでください。';
  renderList();
 }
 async function refresh(){
  notice.textContent='原稿を取得中…';
  try{
   if(typeof apiRequest!=='function')throw new Error('このプレビューではJSON読込を使ってください。');
   const r=await apiRequest('getRonshuten',{includeDrafts:true});save(r);
  }catch(e){notice.textContent='更新できませんでした：'+e.message+' 保存済み原稿は引き続き使えます。';}
 }
 input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{save(JSON.parse(await file.text()));}catch(e){notice.textContent='読込に失敗しました：'+e.message;}finally{input.value='';}};
 function open(){
  active=true;if(home)home.classList.add('hidden');
  ['readerList','readerArticle','study'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
  section.hidden=false;renderList();window.scrollTo(0,0);
 }
 function close(){active=false;section.hidden=true;if(home)home.classList.remove('hidden');}
 function renderList(){
  const query=search.value.trim().toLocaleLowerCase();
  filtered=(snapshot?.topics||[]).filter(t=>(unchecked.checked||t.status==='verified')&&(!subject.value||t.subject===subject.value)&&[t.title,t.trigger,t.rule,t.purpose,...t.factors].join(' ').toLocaleLowerCase().includes(query));
  article.hidden=true;list.hidden=false;list.replaceChildren(el('p',`${filtered.length}論点`));
  for(const t of filtered){const b=button(t.title,()=>show(t.key));b.style.textAlign='left';b.append(el('small',`${t.subject} ＞ ${t.majorCategory} ＞ ${t.category} ｜ ${names[t.status]}`));list.append(b);}
  if(!filtered.length)list.append(el('p','条件に合う原稿がありません。未確認原稿はチェックを入れると表示されます。'));
 }
 function add(parent,title,texts){const values=texts.filter(Boolean);if(!values.length)return;const s=el('section',undefined,'reader-section');s.append(el('h3',title));for(const value of values){const p=el('p',value);p.style.whiteSpace='pre-wrap';s.append(p);}parent.append(s);}
 function link(parent,text,url){const safe=safeUrl(url);if(!safe)return;const a=el('a',text);a.href=safe;a.target='_blank';a.rel='noopener noreferrer';a.style.color='#8bc9ff';parent.append(a);}
 function show(key){
  const t=filtered.find(x=>x.key===key);if(!t)return;currentKey=key;list.hidden=true;article.hidden=false;article.replaceChildren(button('← 検索結果へ',renderList),el('h2',t.title),el('p',`${t.subject} ＞ ${t.majorCategory} ＞ ${t.category}`),el('p',names[t.status]));
  if(t.status!=='verified')add(article,'確認状況',['この原稿には未確認事項があり、確定版としての点検は完了していない。',...t.reviewNotes]);
  add(article,'問題場面・トリガー',[t.trigger]);
  add(article,'条文・制度趣旨',[...t.articles.map(a=>a.text+(a.verified?'':'（未確認）')),t.purpose]);
  for(const a of t.articles)link(article,'条文の典拠を開く',a.source);
  add(article,'規範（答案用）',[t.rule]);add(article,'考慮要素（当てはめ観点）',t.factors.map(x=>'・'+x));
  for(const c of t.cases){add(article,'判例・評価軸',[c.name+(c.verified?'':'（未確認）'),'事実：'+c.facts,'判断：'+c.holding]);link(article,'判例本文を開く',c.source);}
  add(article,'評価軸：肯定・許容方向',t.evaluationAxes?.positive||[]);add(article,'評価軸：否定・制限方向',t.evaluationAxes?.negative||[]);
  add(article,'出典・編集メモ',['元カードID：'+t.sourceCardIds.join(', '),...(t.editorialNotes||[])]);
  const related=filtered.filter(x=>t.relatedTopics.includes(x.key));if(related.length){article.append(el('h3','関連論点'));for(const r of related)article.append(button(r.title,()=>show(r.key)));}
  if(typeof startStudy==='function')article.append(button('この論点のカードで復習',()=>{close();startStudy(t.sourceCardIds);}));
  const i=filtered.indexOf(t);const nav=el('nav');nav.setAttribute('aria-label','論点の前後移動');
  const prev=button('← 前の論点',()=>show(filtered[i-1].key));prev.disabled=i===0;
  const next=button('次の論点 →',()=>show(filtered[i+1].key));next.disabled=i===filtered.length-1;nav.append(prev,next);article.append(nav);window.scrollTo(0,0);
 }
 try{const cached=localStorage.getItem(KEY);if(cached)snapshot=validate(JSON.parse(cached));}catch{notice.textContent='保存原稿を読み込めません。JSONから再読込してください。';}
 if(window.RONSHUTEN_PREVIEW){try{snapshot=validate(window.RONSHUTEN_PREVIEW);}catch(e){notice.textContent=e.message;}}
 populate();
 // Tiny read-only testing/preview API; no access to quiz storage.
 window.RonshutenReader={open,validate,safeUrl,storageKey:KEY};
})();

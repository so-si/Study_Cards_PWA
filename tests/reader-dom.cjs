/* DOM integration checks; does not claim browser or iPhone layout coverage. */
const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const assert=require('node:assert/strict'),fs=require('node:fs');
process.chdir(require('node:path').join(__dirname,'..'));
(async()=>{
 const snapshot=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://test.invalid/',runScripts:'outside-only'});
 const w=dom.window;w.scrollTo=()=>{};w.STUDY_CARDS_CONFIG={apiUrl:''};
 Object.defineProperty(w.navigator,'onLine',{get:()=>false});
 const pending='[{"id":"61","result":"○","eventId":"existing"}]';
 const originalCards=JSON.stringify({cards:[{id:'63',subject:'刑訴法',majorCategory:'捜査',category:'強制処分',topic:'元論点',question:'元の質問',rule:'元の規範',clozeRule:'穴',reason:'元の理由'}],updatedAt:'2026-11-09T00:00:00Z'});
 w.localStorage.setItem('studyCardsPendingV1',pending);w.localStorage.setItem('studyCardsOfflineCardsV1',originalCards);
 for(const script of w.document.querySelectorAll('script:not([src])'))w.eval(script.textContent);
 w.eval(fs.readFileSync('ronshuten-reader.js','utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.RonshutenReader.open();
 const input=w.document.getElementById('ronshutenImport');
 async function load(data){Object.defineProperty(input,'files',{configurable:true,value:[{text:async()=>JSON.stringify(data)}]});await input.onchange();}
 await load(snapshot);
 const list=w.document.getElementById('ronshutenResults');
 assert.equal(list.querySelectorAll('button').length,snapshot.topics.filter(t=>t.status==='verified').length);
 const subj=w.document.querySelector('select[aria-label="論点集の科目"]');subj.value='刑事訴訟法';subj.onchange();
 const unverified=w.document.getElementById('ronshutenUnverified');unverified.checked=true;unverified.onchange();
 assert.equal(list.querySelectorAll('button').length,snapshot.topics.filter(t=>t.subject==='刑事訴訟法').length);
 list.querySelector('button').click();const beforeTitle=w.document.querySelector('#ronshutenBody h2').textContent;
 [...w.document.querySelectorAll('#ronshutenBody button')].find(b=>b.textContent==='次の論点 →').click();
 assert.notEqual(w.document.querySelector('#ronshutenBody h2').textContent,beforeTitle);
 [...w.document.querySelectorAll('#ronshutenBody button')].find(b=>b.textContent==='← 検索結果へ').click();
 const search=w.document.querySelector('input[type=search]');search.value='X線';search.oninput();list.querySelector('button').click();
 assert(w.document.getElementById('ronshutenBody').textContent.includes('元カードID：63'));
 [...w.document.getElementById('ronshutenBody').querySelectorAll('button')].find(b=>b.textContent==='この論点のカードで復習').click();
 assert.equal(w.document.getElementById('question').textContent,'元の質問');
 assert.equal(w.localStorage.getItem('studyCardsPendingV1'),pending);assert.equal(w.localStorage.getItem('studyCardsOfflineCardsV1'),originalCards);

 w.RonshutenReader.open();search.value='';search.oninput();
 const injected=structuredClone(snapshot),t=injected.topics[0];t.title='<img src=x onerror="window.injected=1">';t.status='reviewed';t.reviewNotes=['未確認'];t.verifiedAt=null;t.articles[0].source='javascript:alert(1)';
 await load(injected);assert.equal(w.document.querySelectorAll('#ronshutenReader img').length,0);assert.equal(w.injected,undefined);
 assert.equal(w.RonshutenReader.safeUrl('javascript:alert(1)'),null);
 const saved=w.localStorage.getItem('studyCardsRonshutenV1');await load({schemaVersion:1,topics:[{}]});assert.equal(w.localStorage.getItem('studyCardsRonshutenV1'),saved);
 const storage=w.localStorage,proto=Object.getPrototypeOf(storage),set=proto.setItem;
 proto.setItem=function(){throw new Error('quota exceeded');};await load(snapshot);assert.equal(storage.getItem('studyCardsRonshutenV1'),saved);proto.setItem=set;
 assert.equal(storage.getItem('studyCardsPendingV1'),pending);
 console.log('DOM integration passed: import, search, verified default, unverified labels, source-ID quiz, XSS, invalid input, quota failure, quiz cache and pending queue preservation');
 dom.window.close();
})().catch(e=>{console.error(e);process.exit(1)});

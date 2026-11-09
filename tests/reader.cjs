const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const pending='[{"id":"61","result":"○","eventId":"preserve-existing"}]';
 const card={id:'63',subject:'刑訴法',majorCategory:'捜査',category:'強制処分',topic:'元クイズ',question:'元の質問',rule:'元の規範',clozeRule:'穴',reason:'元の理由'};
 await context.addInitScript(({pending,card})=>{
  if(!localStorage.getItem('testSeeded')){
   localStorage.setItem('studyCardsPendingV1',pending);
   localStorage.setItem('studyCardsOfflineCardsV1',JSON.stringify({cards:[card],updatedAt:'2026-11-09T00:00:00Z'}));
   localStorage.setItem('testSeeded','1');
  }
  Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});
 },{pending,card});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/Study_Cards_PWA/');
 await page.locator('#openRonshuten').click();
 await page.locator('#ronshutenImport').setInputFiles(process.argv[2]);
 await page.waitForFunction(()=>localStorage.getItem('studyCardsRonshutenV1'));
 assert.equal(await page.locator('#ronshutenResults button').count(),data.topics.filter(t=>t.status==='verified').length);
 await page.getByLabel('論点集の科目').selectOption('刑事訴訟法');
 await page.locator('#ronshutenUnverified').check();
 assert.equal(await page.locator('#ronshutenResults button').count(),data.topics.filter(t=>t.subject==='刑事訴訟法').length);
 await page.getByLabel('論点集を検索').fill('X線');
 await page.locator('#ronshutenResults button').first().click();
 await page.getByRole('heading',{name:'規範（答案用）',exact:true}).waitFor();
 assert((await page.locator('#ronshutenBody').innerText()).includes('元カードID：63'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'../work/reader-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'この論点のカードで復習',exact:true}).click();
 assert.equal(await page.locator('#question').innerText(),'元の質問');
 assert.equal(await page.evaluate(()=>localStorage.getItem('studyCardsPendingV1')),pending);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('studyCardsOfflineCardsV1')).cards[0].rule),'元の規範');
 // Reload retains the reading snapshot and quiz queue. Network-independent content is available.
 await page.reload();await page.locator('#openRonshuten').click();
 await page.getByLabel('論点集を検索').fill('X線');await page.locator('#ronshutenResults button').first().click();
 await page.getByRole('heading',{name:'規範（答案用）',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('studyCardsPendingV1')),pending);
 assert.equal(await page.evaluate(()=>RonshutenReader.safeUrl('javascript:alert(1)')),null);
 const injected=structuredClone(data);injected.topics[0].title='<img src=x onerror="window.injected=1">';
 await page.locator('#ronshutenImport').setInputFiles({name:'xss.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(injected))});
 await page.waitForFunction(()=>localStorage.getItem('studyCardsRonshutenV1').includes('<img'));
 assert.equal(await page.locator('#ronshutenReader img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
 // Failed validation leaves previously saved content intact.
 const before=await page.evaluate(()=>localStorage.getItem('studyCardsRonshutenV1'));
 await page.locator('#ronshutenImport').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":1,"topics":[{}]}')});
 await page.getByRole('status').filter({hasText:'読込に失敗'}).waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('studyCardsRonshutenV1')),before);
 assert.deepEqual(errors,[]);console.log('Mobile reader: import, statuses, search, offline reload, XSS, source-ID quiz, queue preservation passed');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

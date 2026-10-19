import {chromium} from '/Users/emreaydin/.npm/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const dir='/Users/emreaydin/ngsaccess/docs/ui-scan/pages/13-ayarlar';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();const errors=[],requests=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
await page.goto('file://'+dir+'/mockup.html');
await page.screenshot({path:dir+'/desktop.png',fullPage:true});
console.log(await page.locator('.top-page').innerText());
for(const width of [1440,390]){
await page.setViewportSize({width,height:900});
for(const section of ['general','users','work-payroll','reports','integrations','mail','notifications']){
if(width===1440)await page.click(`[data-section="${section}"]`);else await page.selectOption('#section-select',section);
const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));results.push({section,...metrics});
if(metrics.scroll>width)throw Error('Overflow '+JSON.stringify(results.at(-1))); 
}
if(width===1440)await page.click('[data-section="general"]');else await page.selectOption('#section-select','general');
await page.screenshot({path:dir+(width===1440?'/desktop.png':'/mobile.png'),fullPage:true});
}
for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.locator('.preview summary').evaluate(e=>e.parentElement.open=true);
for(const role of ['super_admin','project_admin','project_user']){await page.selectOption('#preview-role',role);for(const state of ['ready','loading','error','empty','no-project']){await page.selectOption('#preview-state',state);results.push({role,state,...await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}))});}}
}
await page.goto('file://'+dir+'/mockup.html');
await page.fill('#companyName','Taslak şirket');await page.selectOption('#section-select','integrations');
if(!await page.isVisible('#unsaved-dialog'))throw Error('Dirty guard missing');await page.screenshot({path:dir+'/mobile-unsaved.png'});await page.click('#stay');
if(await page.inputValue('#companyName')!=='Taslak şirket')throw Error('Draft lost');
await page.selectOption('#section-select','integrations');await page.click('#discard');await page.click('#bridge-open');await page.click('#token-reveal');
if(!await page.inputValue('#bridge-token').then(t=>t.includes('gecersiz')))throw Error('Token reveal');
await page.screenshot({path:dir+'/mobile-bridge.png'});await page.click('#token-revoke');await page.click('#revoke-confirm');await page.keyboard.press('Escape');
await page.click('.mobile-menu');if(!await page.locator('#mobile-nav').evaluate(e=>e.contains(document.activeElement)))throw Error('Menu focus');await page.keyboard.press('Escape');
if(!await page.locator('.mobile-menu').evaluate(e=>e===document.activeElement))throw Error('Menu focus return');
await page.setViewportSize({width:1440,height:900});await page.click('[data-section="general"]');await page.fill('#companyName','Korunan taslak');await page.click('[data-project]');await page.click('[data-project-name="Ankara Şube"]');if(!await page.isVisible('#unsaved-dialog'))throw Error('Project guard missing');await page.click('#stay');if(!await page.locator('.project-label').innerText().then(t=>t==='Merkez Ofis'))throw Error('Scope changed early');await page.click('[data-project]');await page.click('[data-project-name="Ankara Şube"]');await page.click('#discard');if(!await page.locator('.project-label').innerText().then(t=>t==='Ankara Şube'))throw Error('Scope not changed');
await page.fill('#companyName','');await page.click('#general-form [type=submit]');if(!await page.isVisible('#company-error'))throw Error('Company validation');await page.fill('#companyName','Ankara Teknoloji');await page.click('#general-form [type=submit]');if(!await page.locator('#general-form .form-result').innerText().then(t=>t.includes('sunucuya kaydedilmedi')))throw Error('Simulation disclosure');
await page.click('[data-section="reports"]');await page.selectOption('#download-type','Devam özeti');if(await page.inputValue('#schedule-type')!=='SGK aylık döküm')throw Error('Coupled report type');
await page.click('[data-section="integrations"]');await page.click('#bridge-open');await page.screenshot({path:dir+'/bridge.png'});await page.keyboard.press('Escape');
await page.keyboard.press('Control+k');await page.fill('#palette-input','İzin');if(!await page.locator('.palette-option').innerText().then(t=>t==='İzinler'))throw Error('Palette');await page.keyboard.press('Escape');
await writeFile(dir+'/VERIFY.json',JSON.stringify({results,errors,externalRequests:requests},null,2));console.log(JSON.stringify({checks:results.length,errors,externalRequests:requests}));await browser.close();

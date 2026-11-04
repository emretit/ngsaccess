const {chromium}=require('/Users/emreaydin/pafta/node_modules/playwright');
const fs=require('fs');const path=require('path');const {pathToFileURL}=require('url');
(async()=>{
 const root=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage(); const results=[];let errors=[];let external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
 for(const view of manifest.newViews){
  errors=[];external=[];
  await page.goto(pathToFileURL(path.join(root,view.name+'.html')).href);await page.evaluate(()=>document.fonts.ready);
  const check=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
   const active=e=>!e.closest('[inert]');
   const targets=[...document.querySelectorAll('button,input,textarea,a')].filter(active);
   return {horizontalOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
    overflowingContainers:[...document.querySelectorAll('.scroll,.sheet-body')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>({class:e.className,overflow:e.scrollWidth-e.clientWidth})),
    smallTargets:targets.filter(e=>{const r=e.getBoundingClientRect();return r.width<47.9||r.height<47.9}).map(e=>({label:e.getAttribute('aria-label')||e.textContent.trim(),...rect(e)})),
    primaryCount:[...document.querySelectorAll('.primary')].filter(active).length,
    primary:[...document.querySelectorAll('.primary')].filter(active).map(e=>({label:e.textContent.trim(),...rect(e)})),
    footer:[...document.querySelectorAll('.form-footer')].filter(active).map(rect),
    keyboard:[...document.querySelectorAll('.keyboard')].map(rect)};
  });
  const shot=path.join(root,'../_shots','B-'+view.name+'.png');await page.screenshot({path:shot});
  const png=fs.readFileSync(shot);results.push({name:view.name,...check,png:[png.readUInt32BE(16),png.readUInt32BE(20)],pageErrors:[...errors],externalRequests:[...external]});
 }
 await browser.close();fs.writeFileSync(path.join(root,'validation.json'),JSON.stringify({viewport:[390,844],dpr:2,results},null,2)+'\n');
 const failures=results.filter(x=>x.horizontalOverflow||x.overflowingContainers.length||x.smallTargets.length||x.primaryCount>1||x.pageErrors.length||x.externalRequests.length||x.png[0]!==780||x.png[1]!==1688);
 console.log(JSON.stringify({captured:results.length,failures},null,2));process.exitCode=failures.length?1:0;
})();

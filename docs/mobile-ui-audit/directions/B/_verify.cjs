const {chromium}=require('/Users/emreaydin/pafta/node_modules/playwright');
const fs=require('fs'),path=require('path'),crypto=require('crypto');const{pathToFileURL}=require('url');
(async()=>{
 const root=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
 const result={screenHtml:manifest.newViews.length+manifest.existingReferences.length,totalHtml:fs.readdirSync(root).filter(n=>n.endsWith('.html')).length,png:[],referenceHashes:[],catalog:[],footerChecks:[]};
 for(const v of [...manifest.newViews,...manifest.existingReferences]){
  const data=fs.readFileSync(path.join(root,'../_shots/B-'+v.name+'.png'));result.png.push({name:v.name,size:[data.readUInt32BE(16),data.readUInt32BE(20)]});
 }
 for(const v of manifest.existingReferences){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,v.name+'.html'))).digest('hex');result.referenceHashes.push({name:v.name,unchanged:hash===v.sha256});}
 const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);
 await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 result.catalog.push(await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,previews:document.images.length,missingImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length})));
 await page.screenshot({path:path.join(root,'_catalog-check.png')});
 await page.setViewportSize({width:390,height:844});
 result.catalog.push(await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,previews:document.images.length})));
 for(const v of manifest.newViews.filter(v=>v.name.includes('form')||v.name.startsWith('leave-')||v.name.startsWith('correction-')||v.name==='history-filter')){
  await page.goto(pathToFileURL(path.join(root,v.name+'.html')).href);
  result.footerChecks.push(await page.evaluate(name=>{
   const footer=document.querySelector('.form-footer:not([inert] .form-footer)'),keyboard=document.querySelector('.keyboard');
   if(!footer)return{name,applicable:false};
   const f=footer.getBoundingClientRect(),k=keyboard?.getBoundingClientRect();const body=document.querySelector('.sheet-body')||document.querySelector('.scroll:not([inert] .scroll)');
   const b=body?.getBoundingClientRect();return{name,applicable:true,visible:f.top>=0&&f.bottom<=844,aboveKeyboard:!k||Math.abs(f.bottom-k.top)<1,contentEndsBeforeFooter:!b||b.bottom<=f.top+1};
  },v.name));
 }
 await browser.close();fs.writeFileSync(path.join(root,'catalog-validation.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({...result,png:{count:result.png.length,invalid:result.png.filter(p=>p.size[0]!==780||p.size[1]!==1688)}},null,2));
})();

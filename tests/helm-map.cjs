const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
(async () => {
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.DEMO_URL || 'http://localhost:18087/Helm/');
  for(const mode of ['LRS','SYSTEM','SRS']) {
   await page.locator(`[data-mode="${mode}"]`).click();
   if(mode==='SYSTEM')assert.match(await page.locator('#scale').innerText(),/30.00 LY/);
   if(mode==='SRS')await page.evaluate(()=>{$('zoom').value=100*Math.log(100/srsMaxRange)/Math.log(1/srsMaxRange);draw()});
   const contact=await page.evaluate(mode=>mapContacts.find(c=>c.name===(mode==='SRS'?'TNS Endeavor':'TNS Horizon')),mode);
   assert.ok(contact,`${mode} renders ships`);
   await page.locator('#map').click({position:{x:contact.x,y:contact.y}});
   assert.match(await page.locator('#mapSelection').innerText(),new RegExp(contact.name));
   if(mode==='SYSTEM') {
    await page.locator('#map').click({position:{x:contact.x,y:contact.y}});
    assert.ok(await page.evaluate(()=>{const c=mapContacts.find(c=>c.name===mapFocus.name);return Math.hypot(c.x-$('map').clientWidth/2,c.y-$('map').clientHeight/2)<1}),'repeated selection centers contact');
   }
   if(mode==='SRS')assert.ok(await page.locator('#useMapTarget').isDisabled());
   console.log(`PASS ${mode}: ship rendering and selection`);
  }
  await page.screenshot({path:'/tmp/shipsim-demo-helm.png'});
  assert.deepEqual(errors,[]);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});

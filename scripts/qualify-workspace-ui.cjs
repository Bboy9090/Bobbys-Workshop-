#!/usr/bin/env node
// Browser-only layout qualification. No native bridge, real target, or device-write authority.
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {mkdirSync,writeFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {setTimeout:delay} = require('node:timers/promises');
const output=resolve('artifacts/workspace-ui');
mkdirSync(output,{recursive:true});
const report={
  schema:'bobfwtools.workspace-ui-evidence.v1',
  sourceRevision:process.env.BOBFWTOOLS_SOURCE_REVISION || process.env.GITHUB_SHA || null,
  runUrl:process.env.GITHUB_RUN_ID ? 'https://github.com/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID : null,
  scope:'Chromium browser preview with no native bridge',
  startedAt:new Date().toISOString(),status:'NOT TESTED',hardwareQualified:false,executionAuthorized:false,
  checks:[],metrics:{},pageErrors:[],
};
let server,browser,page;
let outputTail='';
async function check(name,run) {
  try {await run();report.checks.push({name,status:'PASS'});console.log('PASS '+name);}
  catch(error){report.checks.push({name,status:'FAIL',reason:error.message});throw error;}
}
async function selectView(id,label) {
  await page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('button',{name:label,exact:true}).click();
  await page.waitForFunction(view=>{
    const visible=[...document.querySelectorAll('[data-workspace-panel]')].filter(node=>node.getClientRects().length>0);
    return visible.length===1 && visible[0].getAttribute('data-workspace-panel')===view;
  },id);
  assert.equal(await page.locator('nav[aria-label="Workspace"] button[aria-current="page"]').count(),1);
}
async function noHorizontalOverflow() {
  const dimensions=await page.evaluate(()=>({
    viewport:innerWidth,document:document.documentElement.scrollWidth,
    main:document.querySelector('#workspace-main').clientWidth,
    mainScroll:document.querySelector('#workspace-main').scrollWidth,
  }));
  assert.ok(dimensions.document<=dimensions.viewport+1,JSON.stringify(dimensions));
  assert.ok(dimensions.mainScroll<=dimensions.main+1,JSON.stringify(dimensions));
  return dimensions;
}
(async()=>{
  try {
    assert.ok(process.env.BOBFW_PLAYWRIGHT_MODULE,'Set BOBFW_PLAYWRIGHT_MODULE to the installed Playwright package.');
    const {chromium}=require(process.env.BOBFW_PLAYWRIGHT_MODULE);
    server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:['ignore','pipe','pipe']});
    for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{outputTail=(outputTail+chunk).slice(-6000);});
    const started=Date.now();
    for(;;){
      if(server.exitCode!==null)throw Error('Preview exited: '+outputTail);
      try {if((await fetch('http://127.0.0.1:4173')).ok)break;}catch{}
      if(Date.now()-started>30000)throw Error('Preview did not become ready: '+outputTail);
      await delay(200);
    }
    browser=await chromium.launch({headless:true});
    page=await browser.newPage({viewport:{width:1365,height:900},deviceScaleFactor:1});
    page.on('pageerror',error=>report.pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
    await check('Home is a compact phone workspace with honest browser readiness',async()=>{
      await page.getByRole('heading',{name:'Your phone',exact:true}).waitFor();
      assert.equal(await page.locator('[data-workspace-panel]:visible').count(),1);
      assert.equal(await page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('button').count(),6);
      assert.equal(await page.getByText('Browser preview',{exact:true}).count(),1);
      assert.equal(await page.getByText('Desktop required',{exact:true}).count(),3);
      assert.equal(await page.locator('details[open]').count(),0);
      assert.equal(await page.locator('#service-tools').count(),0,'Advanced tools must not initialize on home.');
      const main=await page.locator('#workspace-main').evaluate(node=>({height:node.clientHeight,scrollHeight:node.scrollHeight}));
      report.metrics.desktopHome={...main,...await noHorizontalOverflow()};
      assert.ok(main.scrollHeight<=main.height+1,'Home unexpectedly needs scrolling: '+JSON.stringify(main));
      await page.screenshot({path:resolve(output,'desktop-phone.png'),fullPage:true});
    });
    await check('All six views show only their own content',async()=>{
      for(const [id,label] of [['diagnose','Diagnostics'],['files','Files & apps'],['firmware','Firmware'],['advanced','Advanced'],['history','History'],['phone','Phone']]){
        await selectView(id,label);
        await noHorizontalOverflow();
      }
    });
    await check('Advanced tools are closed and deferred until requested',async()=>{
      await selectView('advanced','Advanced');
      assert.equal(await page.locator('[data-workspace-panel="advanced"] details').count(),7);
      assert.equal(await page.locator('[data-workspace-panel="advanced"] details[open]').count(),0);
      assert.equal(await page.locator('[data-workspace-panel="advanced"] details > div').count(),0);
      await page.locator('#execution-policy > summary').click();
      await page.locator('#execution-policy > div').waitFor();
      assert.equal(await page.locator('#service-tools > div').count(),0);
      await page.locator('#execution-policy > summary').click();
      await page.screenshot({path:resolve(output,'desktop-advanced.png'),fullPage:true});
    });
    await check('Firmware planning inputs survive navigation and disclosure toggles',async()=>{
      await selectView('firmware','Firmware');
      assert.equal(await page.locator('#recovery-planner[open]').count(),0);
      await page.locator('#recovery-planner > summary').click();
      const field=page.getByPlaceholder('Exact model',{exact:true});
      await field.fill('UI-STATE-ONLY-NO-DEVICE');
      await selectView('phone','Phone');
      await selectView('firmware','Firmware');
      assert.equal(await field.inputValue(),'UI-STATE-ONLY-NO-DEVICE');
      await page.locator('#recovery-planner > summary').click();
      await page.locator('#recovery-planner > summary').click();
      assert.equal(await field.inputValue(),'UI-STATE-ONLY-NO-DEVICE');
      await noHorizontalOverflow();
      await page.screenshot({path:resolve(output,'desktop-firmware.png'),fullPage:true});
    });
    await check('Narrow screens retain navigation without horizontal scrolling',async()=>{
      await page.setViewportSize({width:390,height:844});
      for(const [id,label] of [['phone','Phone'],['diagnose','Diagnostics'],['files','Files & apps'],['advanced','Advanced'],['history','History']]){
        await selectView(id,label);
        await noHorizontalOverflow();
      }
      await selectView('phone','Phone');
      report.metrics.mobileHome=await noHorizontalOverflow();
      await page.screenshot({path:resolve(output,'mobile-phone.png'),fullPage:true});
    });
    await check('No uncaught application errors',async()=>assert.deepEqual(report.pageErrors,[]));
    report.status='PASS';
  }catch(error){
    report.status='FAIL';report.error=error.stack || String(error);report.previewOutput=outputTail;
    console.error(report.error);
    if(page)await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});
    process.exitCode=1;
  }finally{
    report.finishedAt=new Date().toISOString();
    writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log('WORKSPACE_UI_EVIDENCE '+JSON.stringify(report));
    if(browser)await browser.close();
    if(server && server.exitCode===null)server.kill('SIGTERM');
  }
})();

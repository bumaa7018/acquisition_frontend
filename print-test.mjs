import { chromium } from 'playwright';
import fs from 'fs';

const TOKEN = fs.readFileSync(process.env.SC + '/token.txt', 'utf8').trim();
const ACQ = 'cdff5cab-e836-429c-8102-b9c8e5f7e68b';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
const wms = [];
let phase = 'page';
page.on('response', async r => {
  const u = r.url();
  if (u.includes('/api/geoserver/') || u.includes('/api/drone-tiles/')) {
    const ct = r.headers()['content-type'] || '?';
    if (phase === 'print' && u.includes('/land/wms')) {
      const pd = r.request().postData() || '';
      const get = (k) => decodeURIComponent((pd.match(new RegExp('(?:^|&)' + k + '=([^&]*)')) || [,''])[1]).replace(/\+/g,' ');
      let bytes = -1;
      try { bytes = (await r.body()).length } catch {}
      wms.push(`PRINT ${r.status()} ${ct} ${bytes}b L=${get('LAYERS')} S=${get('STYLES')} WH=${get('WIDTH')}x${get('HEIGHT')} BBOX=${get('BBOX')}`);
      return;
    }
    if (ct.includes('xml')) {
      const t = await r.text().catch(() => '');
      wms.push(`!! XML ALDAA: ${(t.match(/<ServiceException[^>]*>([\s\S]*?)<\/ServiceException>/)?.[1] ?? t).replace(/\s+/g,' ').trim().slice(0,300)}`);
    } else wms.push(`${r.status()} ${ct} ${u.split('?')[0]}`);
  }
});

await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.evaluate(t => localStorage.setItem('gov_access_token', t), TOKEN);
// httpOnly session cookie
const res = await page.evaluate(async (t) => {
  const r = await fetch('/api/session', { method: 'POST', headers: { Authorization: 'Bearer ' + t } });
  return r.status + ' ' + (await r.text()).slice(0, 120);
}, TOKEN);
console.log('session route:', res);

await page.goto(`http://localhost:3000/acquisition/${ACQ}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('URL:', page.url());
await page.waitForTimeout(8000);
await page.screenshot({ path: process.env.SC + '/01-page.png' });

// Байршил таб
const tab = page.getByText('Байршил', { exact: true }).first();
if (await tab.count()) { await tab.click(); await page.waitForTimeout(6000); }
await page.screenshot({ path: process.env.SC + '/02-location.png' });

const btn = page.getByRole('button', { name: /Ажлын зураг/ }).first();
if (!(await btn.count())) { console.log('!! Ажлын зураг товч олдсонгүй'); }
else {
  phase = 'print';
  await btn.click();
  await page.waitForTimeout(25000);
  await page.screenshot({ path: process.env.SC + '/03-dialog.png' });
  // Урьдчилан харах зургийг ФАЙЛААР хадгална
  const src = await page.evaluate(() => document.querySelector('img[alt="Ажлын зураг"]')?.src ?? null);
  if (src?.startsWith('data:')) {
    fs.writeFileSync(process.env.SC + '/04-preview.png', Buffer.from(src.split(',')[1], 'base64'));
    console.log('preview хадгалагдлаа');
  } else console.log('!! preview зураг байхгүй:', src);
  const err = await page.evaluate(() => document.body.innerText.match(/Газрын зургийн давхарга ачаалагдсангүй[\s\S]{0,300}/)?.[0] ?? null);
  if (err) console.log('!! ДИАЛОГИЙН АЛДАА:', err);
}

console.log('\n=== GEOSERVER ХҮСЭЛТҮҮД ===');
console.log(wms.filter(w => w.startsWith('PRINT') || w.startsWith('!!')).join('\n') || '(байхгүй)');
console.log('\n=== КОНСОЛ ===');
console.log(logs.filter(l => /error|warn|fail/i.test(l)).slice(0, 30).join('\n') || '(цэвэр)');
await browser.close();

import { chromium } from 'playwright';
import fs from 'fs';
const TOKEN = fs.readFileSync(process.env.SC + '/token.txt', 'utf8').trim();
const ACQ = 'cdff5cab-e836-429c-8102-b9c8e5f7e68b';
const PORTRAIT = process.env.ORIENT === 'portrait';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.evaluate(t => localStorage.setItem('gov_access_token', t), TOKEN);
await page.evaluate(t => fetch('/api/session', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }), TOKEN);
await page.goto(`http://localhost:3000/acquisition/${ACQ}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const tab = page.getByText('Байршил', { exact: true }).first();
if (await tab.count()) { await tab.click(); await page.waitForTimeout(6000); }
await page.getByRole('button', { name: /Ажлын зураг/ }).first().click();
await page.waitForTimeout(20000);
if (PORTRAIT) { await page.selectOption('select >> nth=1', 'portrait'); await page.waitForTimeout(25000); }
const src = await page.evaluate(() => document.querySelector('img[alt="Ажлын зураг"]')?.src ?? null);
if (src?.startsWith('data:')) { fs.writeFileSync(`${process.env.SC}/${process.env.ORIENT}.png`, Buffer.from(src.split(',')[1], 'base64')); console.log('ok'); }
else console.log('!! зураг гарсангүй');
await browser.close();

// Тайлангийн дэлгэцийн зураг авах туслах скрипт.
//   node scripts/report-shots.mjs
// Урьдчилсан нөхцөл: docker-compose.dev ажиллаж байх, /tmp/tok.txt-д хүчинтэй token.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.BASE ?? 'http://localhost';
const OUT = 'public/reports/img';
const TOKEN = fs.readFileSync('/tmp/tok.txt', 'utf8').trim();
const ACQ = 'cdff5cab-e836-429c-8102-b9c8e5f7e68b';
const PARCEL = '78fb3995-2cd2-45a9-bd2c-77282db0a215';

const SHOTS = [
  { f: 'app-01-dashboard.png',      url: '/',                                       wait: 9000 },
  { f: 'app-02-acquisition-list.png', url: '/acquisition',                          wait: 5000 },
  { f: 'app-03-acq-general.png',    url: `/acquisition/${ACQ}`,                     wait: 5000 },
  { f: 'app-04-acq-parcels.png',    url: `/acquisition/${ACQ}?tab=parcels`,         wait: 6000, tab: 'Нэгж талбарууд' },
  { f: 'app-05-acq-location.png',   url: `/acquisition/${ACQ}?tab=map`,             wait: 12000, tab: 'Байршил' },
  { f: 'app-06-parcel-general.png', url: `/parcel/${PARCEL}?acq=${ACQ}`,            wait: 6000 },
  { f: 'app-07-parcel-valuation.png', url: `/parcel/${PARCEL}?acq=${ACQ}`,          wait: 7000, tab: 'Нөхөх олговор' },
  { f: 'app-08-parcel-print.png',   url: `/parcel/${PARCEL}?acq=${ACQ}`,            wait: 5000, tab: 'Эх хэвлэл' },
  { f: 'app-09-decision-draft.png', url: '/decision_draft',                         wait: 5000 },
  { f: 'app-10-report.png',         url: '/report',                                 wait: 7000 },
  { f: 'app-11-map.png',            url: '/map',                                    wait: 12000 },
  { f: 'app-12-users.png',          url: '/users',                                  wait: 5000 },
  { f: 'app-13-roles.png',          url: '/roles',                                  wait: 5000 },
  { f: 'app-14-audit.png',          url: '/audit_logs',                             wait: 5000 },
  { f: 'app-15-settings.png',       url: '/acquisition_category',                   wait: 5000 },
  { f: 'app-16-valuation-org.png',  url: '/valuation_org',                          wait: 5000 },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.evaluate((t) => localStorage.setItem('gov_access_token', t), TOKEN);
await page.evaluate((t) => fetch('/api/session', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }), TOKEN);

for (const s of SHOTS) {
  try {
    await page.goto(BASE + s.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(s.wait);
    if (s.tab) {
      const t = page.getByText(s.tab, { exact: true }).first();
      if (await t.count()) { await t.click(); await page.waitForTimeout(s.wait); }
    }
    await page.screenshot({ path: `${OUT}/${s.f}`, fullPage: false });
    console.log('✓', s.f);
  } catch (e) {
    console.log('✗', s.f, String(e).slice(0, 120));
  }
}

await browser.close();

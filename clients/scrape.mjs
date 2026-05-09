#!/usr/bin/env node
/**
 * URL → Patchright stealth fetch → Markdown
 *
 * NotebookLM MCP의 Patchright 동작 방식을 그대로 차용하되, NotebookLM 프로필과
 * 충돌하지 않도록 별도 userDataDir(`~/Library/Application Support/notebooklm-agent/scraper_profile`)을 사용한다.
 *
 *   node clients/scrape.mjs <URL> [out_dir]
 *
 * env:
 *   SCRAPE_HEADLESS=0   브라우저 창 띄우기 (첫 실행 / 챌린지 우회용)
 *   SCRAPE_CHANNEL=chromium  bundled chromium 강제 (기본: chrome → 실패시 chromium 폴백)
 *
 * 출력:
 *   <out_dir>/<host>-<timestamp>.md      구조화된 마크다운
 *   <out_dir>/<host>-<timestamp>.html    raw HTML (디버깅용)
 *   <out_dir>/<host>-<timestamp>.png     full-page screenshot (디버깅용)
 */
import { chromium } from 'patchright';
import TurndownService from 'turndown';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node clients/scrape.mjs <URL> [out_dir]');
  process.exit(1);
}

const ROOT = process.cwd();
const outDir = path.resolve(process.argv[3] || path.join(ROOT, 'output', 'scraped'));
fs.mkdirSync(outDir, { recursive: true });

const profileDir = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'notebooklm-agent',
  'scraper_profile',
);
fs.mkdirSync(profileDir, { recursive: true });

const headless = process.env.SCRAPE_HEADLESS !== '0';
const preferredChannel = process.env.SCRAPE_CHANNEL || 'chrome';
const mobile = process.env.SCRAPE_MOBILE === '1';

const u = new URL(url);
const host = u.hostname.replace(/^www\./, '');
const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-')
  .replace('T', '_')
  .replace(/Z$/, '');
const slug = `${host}-${stamp}`;
const mdPath = path.join(outDir, `${slug}.md`);
const htmlPath = path.join(outDir, `${slug}.html`);
const pngPath = path.join(outDir, `${slug}.png`);

const log = (...a) => console.error('[scrape]', ...a);
log('URL:', url);
log('host:', host);
log('profile:', profileDir);
log('headless:', headless, '/ channel:', preferredChannel);

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

const baseLaunch = {
  headless,
  viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 },
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
  ...(mobile && {
    userAgent: MOBILE_UA,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  }),
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
  ],
};

async function launch(channel) {
  return chromium.launchPersistentContext(profileDir, { ...baseLaunch, channel });
}

let context;
try {
  context = await launch(preferredChannel);
} catch (e) {
  log(`channel=${preferredChannel} 실패 → chromium 폴백:`, e.message?.split('\n')[0]);
  context = await launch('chromium');
}

const page = (await context.pages())[0] || (await context.newPage());

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
} catch (e) {
  log('navigation error:', e.message);
}

const finalUrl = page.url();
log('final url:', finalUrl);

const fullHtml = await page.content();
fs.writeFileSync(htmlPath, fullHtml);
await page.screenshot({ path: pngPath, fullPage: true }).catch((e) => log('screenshot 실패:', e.message));

let extracted;
if (/coupang\.com$/.test(host)) {
  extracted = await extractCoupang(page);
  extracted.__source = 'coupang';
} else if (/(smartstore|shopping|brand)\.naver\.com$/.test(host)) {
  extracted = await extractNaverStore(page);
  extracted.__source = 'naver';
} else {
  extracted = await extractGeneric(page);
  extracted.__source = 'generic';
}

const md = renderMD({ url, finalUrl, host, extracted });
fs.writeFileSync(mdPath, md);

log('saved md  :', mdPath);
log('saved html:', htmlPath);
log('saved png :', pngPath);

await context.close().catch(() => {});
process.exit(0);

async function extractCoupang(page) {
  return page.evaluate(() => {
    const T = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
    const TS = (sel) =>
      Array.from(document.querySelectorAll(sel))
        .map((e) => e.textContent?.trim())
        .filter(Boolean);
    return {
      title:
        T('h1.prod-buy-header__title') ||
        T('h2.prod-buy-header__title') ||
        T('.prod-buy-header__title') ||
        T('h1') ||
        document.title,
      brand: T('.prod-brand-name') || T('a.prod-brand-name'),
      priceCurrent:
        T('.total-price strong') ||
        T('.prod-price .total-price') ||
        T('.price-value') ||
        T('span.total-price'),
      priceOriginal: T('.origin-price') || T('.prod-origin-price'),
      discount: T('.discount-percentage') || T('.prod-discount-rate'),
      coupon: T('.coupon-price'),
      rating:
        T('.prod-buy-header__star-rating .rating') ||
        T('.rating-star-num') ||
        T('.average-star-rating'),
      reviewCount:
        T('.prod-buy-header__rating-counts') ||
        T('.count') ||
        T('.review-count'),
      delivery: T('.prod-pricing-info') || T('.prod-shipping-fee-message'),
      arrival:
        T('.prod-shipping-fee-arrival-info') ||
        T('.prod-rocket-bm-message') ||
        T('.prod-rocket-fresh-message'),
      options: TS('.prod-option__items .prod-option__item').slice(0, 30),
      bullets: TS('.prod-description .prod-description-list li, .prod-description ul li').slice(
        0,
        50,
      ),
      attrTable: TS('.prod-attr-item-list li, .prod-description-attribute tr')
        .map((s) => s.replace(/\s+/g, ' '))
        .slice(0, 80),
      images: Array.from(document.querySelectorAll('.prod-image img, img.prod-image__detail'))
        .map((img) => img.src)
        .filter((s) => s && s.startsWith('http'))
        .slice(0, 10),
    };
  });
}

async function extractNaverStore(page) {
  return page.evaluate(() => {
    const T = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
    const TS = (sel) =>
      Array.from(document.querySelectorAll(sel))
        .map((e) => e.textContent?.trim())
        .filter(Boolean);
    return {
      title:
        T('[class*=Productinfo_title]') ||
        T('h3._22kNQuEXmb') ||
        T('h2') ||
        T('h3') ||
        document.title,
      brand: T('[class*=brand]') || T('a[href*="/main"]'),
      priceCurrent:
        T('[class*=Price_price]') ||
        T('._1LY7DqCnwR') ||
        T('strong[class*=price]') ||
        T('em[class*=price]'),
      priceOriginal: T('[class*=Price_original]') || T('del'),
      discount: T('[class*=discount]'),
      rating: T('[class*=Rating]') || T('em[class*=score]'),
      reviewCount: T('[class*=ReviewCount]') || T('a[href*=review] em'),
      options: TS('[class*=OptionItem]').slice(0, 30),
      bullets: TS('[class*=detail] li').slice(0, 50),
      attrTable: TS('[class*=spec] li, [class*=Spec_] li').slice(0, 80),
    };
  });
}

async function extractGeneric(page) {
  const fullText = await page.evaluate(() => document.body?.innerText || '');
  const html = await page.content();
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const slice = (bodyMatch ? bodyMatch[1] : html).slice(0, 200000);
  let md = '';
  try {
    md = td.turndown(slice);
  } catch {
    md = '';
  }
  return {
    title: await page.title(),
    bodyText: fullText.slice(0, 8000),
    bodyMD: md.slice(0, 12000),
  };
}

function renderMD({ url, finalUrl, host, extracted }) {
  const L = [];
  L.push(`# ${extracted.title || '(제목 없음)'}`);
  L.push('');
  L.push(`> 출처: ${url}`);
  if (finalUrl && finalUrl !== url) L.push(`> 최종 URL: ${finalUrl}`);
  L.push(`> 호스트: ${host}`);
  L.push(`> 파서: ${extracted.__source}`);
  L.push(`> 수집 시각: ${new Date().toISOString()}`);
  L.push('');

  const kv = [
    ['브랜드/판매자', extracted.brand],
    ['가격(현재)', extracted.priceCurrent],
    ['정가', extracted.priceOriginal],
    ['할인율', extracted.discount],
    ['쿠폰가', extracted.coupon],
    ['평점', extracted.rating],
    ['리뷰 수', extracted.reviewCount],
    ['배송', extracted.delivery],
    ['도착 안내', extracted.arrival],
  ];
  for (const [k, v] of kv) if (v) L.push(`- **${k}**: ${v.replace(/\s+/g, ' ')}`);

  if (extracted.options?.length) {
    L.push('', '## 옵션');
    for (const o of extracted.options) L.push(`- ${o}`);
  }
  if (extracted.bullets?.length) {
    L.push('', '## 주요 특징');
    for (const b of extracted.bullets) L.push(`- ${b}`);
  }
  if (extracted.attrTable?.length) {
    L.push('', '## 상품 정보 / 스펙');
    for (const r of extracted.attrTable) L.push(`- ${r}`);
  }
  if (extracted.images?.length) {
    L.push('', '## 이미지');
    for (const i of extracted.images) L.push(`- ${i}`);
  }
  if (extracted.bodyMD) {
    L.push('', '## 본문 (자동 변환)', '', extracted.bodyMD);
  } else if (extracted.bodyText) {
    L.push('', '## 본문 (텍스트)', '', extracted.bodyText);
  }

  return L.join('\n');
}

// Price consistency test. Run: node --test tests/prices.test.mjs
// The Stripe payment-link map in /site-analytics.js is the one price source. Every buy button label, every
// JSON-LD offer price and the pricing table must match it, so a price change fails here until all of them move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const js = fs.readFileSync(path.join(root, 'site-analytics.js'), 'utf8');
const map = {};
for (const m of js.matchAll(/'([A-Za-z0-9]{20,})': \{ item_id: '(\w+)', item_name: '[^']+', price: (\d+) \}/g)) map[m[1]] = { tier: m[2], price: +m[3] };
const pages = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'tests') continue;
  const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) pages.push(p); } })(root);

test('price map has both tiers', () => { assert.deepEqual(Object.values(map).map(x => x.price).sort((a, b) => a - b), [99, 279]); });

test('every buy button label shows the price of its Stripe link', () => {
  for (const f of pages) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<a\b[^>]*href="https:\/\/buy\.stripe\.com\/([A-Za-z0-9]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
      const t = map[m[1]]; assert.ok(t, `${f}: unknown Stripe link ${m[1]}`);
      const prices = [...m[2].matchAll(/\$(\d+)/g)].map(x => +x[1]);
      for (const p of prices) assert.equal(p, t.price, `${path.relative(root, f)}: label "${m[2].trim()}" vs map ${t.price}`);
    }
  }
});

test('JSON-LD offer prices exist in the price map', () => {
  const allowed = new Set(Object.values(map).map(x => String(x.price)).concat(['0']));
  for (const f of pages) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/"price":\s*"?(\d+(?:\.\d+)?)"?/g)) assert.ok(allowed.has(String(+m[1])), `${path.relative(root, f)}: JSON-LD price ${m[1]}`);
  }
});

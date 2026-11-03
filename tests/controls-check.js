// Checks that the fixes work, and runs full campaigns without errors.
// Run: node tests/controls-check.js
import { createGame, skipToNextClose, setControl, hire, advanceTo, setApprovedLimit } from '../js/sim/sim.js';
import { finalScore } from '../js/sim/report.js';
import { questionById } from '../js/sim/weekly.js';

let fails = 0;
const ok = (name, cond, info = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${info}`); if (!cond) fails++; };

// 1. Fixes switched on from day one (set directly, as if they were already live)
{
  const s = createGame({ seed: 7 });
  Object.assign(s.controls, { credit: 'hardstop', md: 'fm_only', invoicing: 'fromDN', cutoff: 'checklist', askRefs: 'on' });
  skipToNextClose(s);
  const r = s.reports[0];
  const k = Object.fromEntries(r.kpis.map((x) => [x.id, x.val]));
  const o = (id) => s.orders.find((x) => x.id === id);
  ok('hard stop: O-102 not released by Sales', !o('O-102').released || o('O-102').releasedBy !== 'SE', o('O-102').stage);
  ok('fm_only: D4 limit stays 30,000', s.dealers.D4.erpLimit === 30000);
  ok('O-108 passes legitimately (27,800 inside the 30,000 limit)', o('O-108').credit.pol.exposure === 27800 && !o('O-108').flags.creditBreach);
  ok('credit breaches 0%', k.creditBreach === 0, k.creditBreach);
  ok('O-105 invoiced for 12 units', s.invoices.find((i) => i.order === 'O-105').qty === 12);
  ok('O-108 invoiced in March', s.invoices.find((i) => i.order === 'O-108').day <= 30);
  ok('O-109 invoiced in March', !!s.invoices.find((i) => i.order === 'O-109' && i.day <= 30));
  ok('booked = correct revenue', r.booked === r.correct, `${r.booked} vs ${r.correct}`);
  ok('R-4 has a reference', !!s.receipts.find((x) => x.dealer === 'D4').ref);
  ok('auditors accept March', !r.auditFail);
}

// 2. Changing a control charges the cost and goes live later
{
  const s = createGame({ seed: 3 });
  const cash0 = s.cash;
  const res = setControl(s, 'credit', 'hardstop');
  ok('setControl ok', res.ok, res.msg || res.why);
  ok('cost charged', s.cash === cash0 - 12000);
  ok('pending, not live yet', s.controls.credit === 'warning' && s.pending.credit);
  advanceTo(s, 15 * 1440 + 480);
  ok('live after 14 days', s.controls.credit === 'hardstop');
  ok('auto-invoice needs e-POD', !setControl(s, 'invoicing', 'auto').ok);
  ok('split duties needs a hire', !setControl(s, 'roles', 'split').ok);
  ok('hire works', hire(s, 'CAO').ok);
}

// 2b. A limit approved by the Finance Manager is not an unauthorised change
{
  const s = createGame({ seed: 5 });
  setApprovedLimit(s, 'D1', 90000);
  skipToNextClose(s);
  const k = Object.fromEntries(s.reports[0].kpis.map((x) => [x.id, x.val]));
  ok('FM-approved limit not counted as unauthorised', k.mdChanges === 1, k.mdChanges);
}

// 2c. Weekly review: nothing mid-day, up to 5 questions at the end of each 7th day
{
  const s = createGame({ seed: 11 });
  advanceTo(s, 3 * 1440 + 13 * 60);
  ok('no questions mid-week', s.weekReview == null);
  advanceTo(s, 7 * 1440 + 480);
  const wr = s.weekReview;
  ok('weekly review after day 7', !!wr && wr.end === 6, wr && wr.label);
  ok('1 to 5 questions', wr && wr.ids.length >= 1 && wr.ids.length <= 5, wr && wr.ids.join(','));
  let valid = true;
  for (const id of wr ? wr.ids : []) {
    const q = questionById(s, id);
    if (!q || q.answer < 0 || q.answer >= q.options.length || new Set(q.options).size !== q.options.length) { valid = false; console.log('  bad question', id, q); }
  }
  ok('every question has distinct options and one valid answer', valid);
  ok('SE named on orders', s.orders.filter((o) => o.se != null).length === s.orders.length, s.orders.map((o) => o.id + ':SE' + (o.se + 1)).join(' '));
  skipToNextClose(s);
  ok('skip month keeps one review only', s.weekReview && s.weekReview.ids.length <= 5, s.weekReview && s.weekReview.label);
  // all weekly questions across a campaign are valid
  const c = createGame({ seed: 4 });
  let bad = 0, total = 0;
  while (!c.over) { skipToNextClose(c); for (const [id, q] of Object.entries(c.dynQ)) { total++; if (q.answer < 0 || new Set(q.options).size !== q.options.length) bad++; } }
  ok('all generated weekly questions valid', bad === 0, `${total} checked`);
}

// 3. Full campaigns: as-is and "consultant" play, several seeds
for (const seed of [1, 2, 3]) {
  const a = createGame({ seed });
  while (!a.over) skipToNextClose(a);
  const fa = finalScore(a);
  const b = createGame({ seed });
  setControl(b, 'md', 'fm_only'); setControl(b, 'cutoff', 'checklist'); setControl(b, 'invoicing', 'fromDN');
  setControl(b, 'askRefs', 'on'); setControl(b, 'cashapp', 'daily'); setControl(b, 'monitoring', 'weekly');
  setControl(b, 'credit', 'hardstop'); setControl(b, 'mdReport', 'on');
  skipToNextClose(b);
  setControl(b, 'pricing', 'p2'); setControl(b, 'shortage', 'backorder'); setControl(b, 'count', 'monthly'); setControl(b, 'dni', 'on');
  hire(b, 'CAO');
  setApprovedLimit(b, 'D1', 90000); setApprovedLimit(b, 'D3', 130000); setApprovedLimit(b, 'D4', 45000);
  skipToNextClose(b);
  setControl(b, 'roles', 'split'); setControl(b, 'pod', 'epod'); setControl(b, 'intake', 'form');
  while (!b.over) skipToNextClose(b);
  const fb = finalScore(b);
  console.log(`seed ${seed}: as-is → ${a.over.result} ${fa.grade} ${fa.total} (KPI ${fa.kpiAvg}, profit ${fa.profit}, cash ${a.cash}) | fixed → ${b.over.result} ${fb.grade} ${fb.total} (KPI ${fb.kpiAvg}, profit ${fb.profit}, cash ${b.cash})`);
  console.log('   as-is monthly KPI scores:', a.reports.map((r) => r.score).join(', '), '| fixed:', b.reports.map((r) => r.score).join(', '));
  ok(`seed ${seed}: fixed beats as-is`, fb.total > fa.total);
}
console.log(fails ? `\n${fails} check(s) FAILED` : '\nAll control checks passed.');
process.exit(fails ? 1 : 0);

// Runs March with every control left as "today" and checks the result against the
// Problem 1 solution workbook. Run: node tests/march-check.js
import { createGame, skipToNextClose } from '../js/sim/sim.js';

let fails = 0;
const eq = (name, got, want) => {
  const ok = typeof want === 'number' ? Math.abs(got - want) < 0.006 : got === want;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${typeof got === 'number' ? +got.toFixed(4) : got}${ok ? '' : `  (expected ${want})`}`);
  if (!ok) fails++;
};

const s = createGame({ seed: 1 });
skipToNextClose(s);
const r = s.reports[0];
const k = Object.fromEntries(r.kpis.map((x) => [x.id, x.val]));
const inv = (id) => s.invoices.find((i) => i.id === id);
const dn = (id) => s.deliveries.find((d) => d.dn === id);

eq('report month', r.monthName, 'March 2025');
eq('orders in March', r.orders, 9);
eq('deliveries', r.delivered, 8);
eq('booked revenue (ERP)', r.booked, 185900);
eq('correct revenue (delivered)', r.correct, 205200);
eq('revenue gap', r.gap, 19300);
eq('gross error %', r.grossErrPct, 0.1496);
eq('receivables in books', r.erpAR, 129900);
eq('receivables corrected', r.trueAR, 149200);
eq('overdue', r.overdue, 20000);
eq('KPI credit breaches', k.creditBreach, 0.25);
eq('KPI overrides documented', k.overrideDocs, 1);
eq('KPI discounts right level', k.discountOk, 2 / 3);
eq('KPI unauthorised md changes', k.mdChanges, 1);
eq('KPI invoices right first time', k.rightFirst, 0.625);
eq('KPI delivered not invoiced', k.dni, 10000);
eq('KPI unapplied receipts', k.unapplied, 10000 / 111000);
eq('KPI overdue %', k.overdue, 20000 / 129900);
eq('KPI cycle days', k.cycle, 11);
eq('KPI touches', k.touches, 9);
eq('KPI exceptions', k.exceptions, 5 / 9);
eq('exception orders', r.grid.filter((g) => g.any).map((g) => g.id).join(','), 'O-102,O-104,O-105,O-108,O-109');
eq('credit breach orders', r.grid.filter((g) => g.credit).map((g) => g.id).join(','), 'O-102,O-108');
eq('approved override', r.grid.filter((g) => g.override).map((g) => g.id).join(','), 'O-106');
eq('O-107 held/cancelled', ['held', 'cancelled'].includes(s.orders.find((o) => o.id === 'O-107').stage), true);
eq('INV-905 amount', inv('INV-905').amount, 28500);
eq('INV-905 qty', inv('INV-905').qty, 15);
eq('DN-505 qty', dn('DN-505').qty, 12);
eq('INV-907 date (2-Apr = day 32)', inv('INV-907').day, 32);
eq('INV-907 order', inv('INV-907').order, 'O-108');
eq('O-109 never invoiced', dn('DN-508').inv, null);
eq('DN-507 order', dn('DN-507').order, 'O-108');
eq('DN-506 day (21-Mar = 20)', dn('DN-506').day, 20);
eq('INV-904 amount', inv('INV-904').amount, 26400);
eq('O-104 below floor', s.orders.find((o) => o.id === 'O-104').belowFloor, 600);
eq('O-108 policy exposure', s.orders.find((o) => o.id === 'O-108').credit.pol.exposure, 33500);
eq('O-102 policy exposure', s.orders.find((o) => o.id === 'O-102').credit.pol.exposure, 50000);
eq('O-106 policy exposure', s.orders.find((o) => o.id === 'O-106').credit.pol.exposure, 96000);
eq('O-107 policy exposure', s.orders.find((o) => o.id === 'O-107').credit.pol.exposure, 55000);
eq('R-4 on suspense', s.receipts.find((x) => x.id === 'R-4').suspense, true);
eq('receipts in March', s.receipts.filter((x) => x.day <= 30).reduce((a, x) => a + x.amount, 0), 111000);
eq('auditors reject March', r.auditFail, true);
console.log(fails ? `\n${fails} check(s) FAILED` : '\nAll March checks passed.');
process.exit(fails ? 1 : 0);

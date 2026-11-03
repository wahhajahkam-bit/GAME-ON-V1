// Draws the business on a canvas. Logical size 1000 × 620; scaled to fit.
import * as D from '../data.js';
import { dayOf, minOf, DAY_START } from '../sim/time.js';
import { dealerBalance, dealerOverdue, headcount } from '../sim/sim.js';

export const W = 1000, H = 620;
export const ZONES = [
  { id: 'inbox', x: 16, y: 16, w: 160, h: 210, label: 'Dealer orders', sub: 'WhatsApp / phone', step: 'intake', c: 'ctrl' },
  { id: 'sales', x: 190, y: 16, w: 200, h: 130, label: 'Sales desk', sub: 'enter order, price, release', step: 'pricing', c: 'price' },
  { id: 'sm', x: 190, y: 156, w: 96, h: 70, label: 'Sales Manager', step: 'pricing', c: 'price' },
  { id: 'gm', x: 294, y: 156, w: 96, h: 70, label: 'General Mgr', step: 'pricing', c: 'price' },
  { id: 'erp', x: 404, y: 16, w: 180, h: 120, label: 'ERP system', sub: 'credit check', step: 'credit', c: 'credit' },
  { id: 'hold', x: 404, y: 146, w: 180, h: 80, label: 'Credit hold', step: 'credit', c: 'bad' },
  { id: 'wh', x: 598, y: 16, w: 290, h: 220, label: 'Warehouse', sub: 'pick and ship', step: 'warehouse', c: 'bill' },
  { id: 'bay', x: 898, y: 16, w: 90, h: 220, label: 'Loading bay', sub: 'to dealers →', step: 'pod', c: 'bill' },
  { id: 'project', x: 16, y: 236, w: 160, h: 110, label: 'Hotel project', step: null, c: 'rev' },
  { id: 'md', x: 190, y: 236, w: 200, h: 110, label: 'Customer master data', step: 'md', c: 'ctrl' },
  { id: 'fm', x: 404, y: 236, w: 180, h: 110, label: 'Finance Manager', sub: 'credit, approvals, review', step: 'monitoring', c: 'ctrl' },
  { id: 'billing', x: 598, y: 246, w: 190, h: 100, label: 'Billing', step: 'invoicing', c: 'bill' },
  { id: 'close', x: 16, y: 356, w: 374, h: 96, label: 'Month-end close', step: 'cutoff', c: 'rev' },
  { id: 'roles', x: 404, y: 356, w: 180, h: 96, label: 'Roles and duties', step: 'roles', c: 'ctrl' },
  { id: 'cash', x: 598, y: 356, w: 190, h: 96, label: 'Cash application', step: 'cashapp', c: 'cash' },
  { id: 'bank', x: 798, y: 246, w: 190, h: 206, label: 'Bank', step: 'cashapp', c: 'cash' },
  { id: 'dealers', x: 16, y: 462, w: 772, h: 142, label: 'Dealers (what they owe, per the ERP)', step: 'credit', c: 'credit' },
  { id: 'books', x: 798, y: 462, w: 190, h: 142, label: 'This month', step: null, c: 'rev', tab: 'books' },
];
const SPOT = { sales: [300, 126], sm: [262, 210], gm: [366, 210], erp: [494, 126], fm: [494, 300], warehouse: [742, 128],
  truck: [930, 120], billing: [735, 300], cash: [735, 425] };
const HOME = {
  SE: [[214, 66], [254, 66], [294, 66], [334, 66]], SM: [[268, 206]], GM: [[372, 206]], FM: [[426, 296]],
  CR: [[552, 296], [552, 322]], BC: [[770, 272], [770, 298], [745, 272]], CAO: [[770, 384], [770, 410]],
  WH: [[650, 220], [690, 220], [730, 220], [770, 220]], DR: [[920, 66], [950, 66], [920, 92]],
};

let colors = {};
export function readColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['bg', 'surface', 'ink', 'muted', 'line', 'soft', 'credit', 'price', 'bill', 'rev', 'cash', 'ctrl', 'good', 'warn', 'bad', 'floor', 'zone'])
    colors[k] = cs.getPropertyValue('--' + k).trim();
}
const col = (k) => colors[k] || '#888';
const n0 = (x) => Math.round(x).toLocaleString('en-US');
const kfmt = (x) => (Math.abs(x) >= 1000 ? (Math.round(x / 100) / 10).toLocaleString('en-US') + 'k' : String(Math.round(x)));

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function text(ctx, s, x, y, font, color, align = 'left') { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y); }
const FB = (w, px) => `${w} ${px}px Figtree, system-ui, sans-serif`;
const FM = (px) => `600 ${px}px "IBM Plex Mono", ui-monospace, monospace`;

// Order boxes are recorded here each frame for click hit-testing
export let hits = [];

export function draw(ctx, s, ui) {
  hits = [];
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = col('floor'); ctx.fillRect(0, 0, W, H);
  const t = s.t;
  // zones
  for (const z of ZONES) {
    rr(ctx, z.x, z.y, z.w, z.h, 10);
    ctx.fillStyle = z.id === 'hold' ? mix(col('bad'), 0.08) : col('zone'); ctx.fill();
    ctx.lineWidth = ui.hover === z.id ? 2.5 : 1; ctx.strokeStyle = ui.hover === z.id ? col(z.c) : col('line'); ctx.stroke();
    ctx.fillStyle = col(z.c); ctx.fillRect(z.x + 8, z.y + 9, 4, 13);
    text(ctx, z.label, z.x + 17, z.y + 20, FB(700, 13), col('ink'));
    if (z.sub) {
      ctx.font = FB(700, 13); const lw = ctx.measureText(z.label).width; ctx.font = FB(500, 10.5);
      if (lw + ctx.measureText(z.sub).width + 34 < z.w) text(ctx, z.sub, z.x + z.w - 8, z.y + 20, FB(500, 10.5), col('muted'), 'right');
    }
  }
  drawInbox(ctx, s);
  drawErp(ctx, s);
  drawWarehouse(ctx, s, ui);
  drawMd(ctx, s);
  drawFm(ctx, s);
  drawBilling(ctx, s);
  drawCash(ctx, s);
  drawBank(ctx, s);
  drawProject(ctx, s);
  drawClose(ctx, s);
  drawRoles(ctx, s);
  drawDealers(ctx, s);
  drawBooks(ctx, s);
  drawOrders(ctx, s, ui);
  drawTruck(ctx, s);
  drawStaff(ctx, s, ui);
  // dusk shading near end of day
  const m = minOf(t);
  if (m > 1020) { ctx.fillStyle = `rgba(10,14,40,${Math.min(0.18, (m - 1020) / 60 * 0.18)})`; ctx.fillRect(0, 0, W, H); }
}

function mix(hex, a) {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawInbox(ctx, s) {
  // phone
  rr(ctx, 30, 30 + 14, 132, 176, 14); ctx.fillStyle = col('soft'); ctx.fill();
  const msgs = s.inbox.slice(-4).reverse();
  let y = 52;
  for (const m of msgs) {
    const age = s.t - m.t;
    const lines = wrap(ctx, m.text, 112, FB(500, 10.5));
    const h = lines.length * 12.5 + 8;
    if (y + h > 172) break;
    rr(ctx, 36, y, 120, h, 7); ctx.fillStyle = age < 180 ? mix(col('good'), 0.25) : col('zone'); ctx.fill();
    lines.forEach((l, i) => text(ctx, l, 41, y + 13 + i * 12.5, FB(500, 10.5), col('ink')));
    y += h + 4;
  }
  if (!msgs.length) text(ctx, 'No messages yet', 96, 120, FB(500, 11), col('muted'), 'center');
  const chan = s.controls.intake;
  text(ctx, chan === 'portal' ? 'Dealer portal' : chan === 'form' ? 'Order template' : 'WhatsApp', 96, 216, FB(700, 10), col('muted'), 'center');
}
function wrap(ctx, str, w, font) {
  ctx.font = font; const words = str.split(' '); const out = []; let line = '';
  for (const wd of words) { const tt = line ? line + ' ' + wd : wd; if (ctx.measureText(tt).width > w && line) { out.push(line); line = wd; } else line = tt; }
  if (line) out.push(line); return out.slice(0, 4);
}

function drawErp(ctx, s) {
  rr(ctx, 416, 40, 156, 64, 6); ctx.fillStyle = '#16203A'; ctx.fill();
  const mode = s.controls.credit;
  text(ctx, mode === 'warning' ? 'CREDIT: WARNING ONLY' : mode === 'hardstop' ? 'CREDIT: HARD STOP' : 'HARD STOP + 4H SLA', 424, 55, FM(9.5), mode === 'warning' ? '#FFC145' : '#69DB7C');
  const warn = s.log.filter((l) => l.kind === 'bad' && s.t - l.t < 600).length;
  text(ctx, `Released today: ${s.orders.filter((o) => o.releaseDay === dayOf(s.t)).length}`, 424, 70, FM(9.5), '#E8ECF7');
  text(ctx, `Alerts (10h): ${warn}`, 424, 84, FM(9.5), warn ? '#FF6B6B' : '#E8ECF7');
  text(ctx, `Limits: ${s.controls.md === 'asis' ? 'Sales can edit' : 'FM only'}`, 424, 98, FM(9.5), s.controls.md === 'asis' ? '#FFC145' : '#69DB7C');
  const held = s.orders.filter((o) => o.stage === 'held').length;
  text(ctx, held ? `${held} order${held > 1 ? 's' : ''} held` : 'none held', 576, 162, FB(600, 10.5), held ? col('bad') : col('muted'), 'right');
}

function stockVisible(s, p) {
  const c = s.controls.count;
  if (c === 'scan') return { live: true, real: s.stock[p].real };
  if (s.stock[p].lastCount) return { live: false, real: s.stock[p].lastCount.real, day: s.stock[p].lastCount.day };
  return null;
}
function drawWarehouse(ctx, s, ui) {
  D.PRODUCT_IDS.forEach((p, i) => {
    const x = 612 + i * 92, y = 44;
    rr(ctx, x, y, 84, 100, 6); ctx.fillStyle = col('soft'); ctx.fill();
    text(ctx, p, x + 6, y + 14, FB(800, 12.5), col('bill'));
    const st = s.stock[p];
    // shelves: draw boxes for what the ERP says
    const n = Math.max(0, Math.min(60, st.sys));
    for (let k = 0; k < n; k++) {
      const bx = x + 6 + (k % 10) * 7.4, by = y + 20 + Math.floor(k / 10) * 8;
      ctx.fillStyle = mix(col('bill'), 0.55); ctx.fillRect(bx, by, 6, 6);
    }
    text(ctx, 'ERP ' + st.sys, x + 6, y + 80, FM(11.5), col('ink'));
    const v = stockVisible(s, p);
    if (!v) text(ctx, 'Real ?', x + 6, y + 94, FM(11.5), col('muted'));
    else {
      const diff = st.sys - v.real;
      text(ctx, 'Real ' + v.real + (v.live ? '' : '*'), x + 6, y + 94, FM(11.5), diff && v.live ? col('bad') : col('good'));
    }
    if (s.onOrder[p]) text(ctx, '+' + s.onOrder[p] + ' due', x + 78, y + 14, FB(700, 10), col('rev'), 'right');
  });
  const vis = s.controls.count;
  text(ctx, vis === 'none' ? 'Real stock unknown: nobody counts' : vis === 'scan' ? 'Barcode scanning: live' : '* = at the last count', 612, 162, FB(500, 11), col('muted'));
  const bo = s.orders.filter((o) => o.backorder > 0).length, wait = s.orders.filter((o) => o.waitStock > 0 && o.stage === 'warehouse').length;
  if (bo || wait) text(ctx, `${bo ? bo + ' back-order' + (bo > 1 ? 's' : '') : ''}${bo && wait ? ' · ' : ''}${wait ? wait + ' waiting for stock' : ''}`, 878, 162, FB(700, 11), col('warn'), 'right');
}

function drawMd(ctx, s) {
  let y = 266;
  for (const id of D.DEALER_IDS) {
    y += 15;
    const d = s.dealers[id];
    const diff = d.erpLimit !== d.approvedLimit;
    text(ctx, `${id} ${D.DEALERS[id].short}`, 200, y, FB(600, 10.5), col('ink'));
    text(ctx, kfmt(d.erpLimit), 382, y, FM(11), diff ? col('bad') : col('ink'), 'right');
    if (diff) text(ctx, `appr. ${kfmt(d.approvedLimit)}`, 346, y, FB(700, 10), col('bad'), 'right');
  }
  text(ctx, s.controls.md === 'asis' ? 'Sales can edit limits' : 'Only the FM approves limits', 200, 340, FB(600, 10.5), s.controls.md === 'asis' ? col('warn') : col('good'));
}
function drawFm(ctx, s) {
  const held = s.orders.filter((o) => o.stage === 'held').length;
  const pend = Object.keys(s.pending).length;
  text(ctx, `Ageing review: ${s.controls.monitoring}`, 414, 325, FB(600, 11), col('muted'));
  if (held) text(ctx, `${held} credit decision${held > 1 ? 's' : ''} waiting`, 414, 340, FB(700, 11), col('warn'));
  else if (pend) text(ctx, `${pend} change${pend > 1 ? 's' : ''} being set up`, 414, 340, FB(600, 11), col('rev'));
}
function drawBilling(ctx, s) {
  const waiting = s.deliveries.filter((d) => !d.inv && !d.missed && !d.lost).length;
  const paper = s.deliveries.filter((d) => d.podDay == null).length;
  text(ctx, `Waiting for invoice: ${waiting}`, 608, 290, FB(600, 11.5), col('ink'));
  text(ctx, `${s.controls.pod === 'paper' ? 'Paper notes still out: ' + paper : 'Notes: e-POD / scan'}`, 608, 307, FB(500, 11), col('muted'));
  const dni = s.controls.dni === 'on' || s.controls.cutoff === 'checklist';
  const missed = s.deliveries.filter((d) => d.missed && !d.inv).length;
  text(ctx, dni ? `Forgotten deliveries: ${missed}` : 'Forgotten: ? (no report)', 608, 324, FB(600, 11), dni && missed ? col('bad') : col('muted'));
  text(ctx, s.controls.invoicing === 'asis' ? 'Qty copied from order' : s.controls.invoicing === 'auto' ? 'Automatic from e-POD' : 'Qty from delivery note', 608, 340, FB(500, 10.5), s.controls.invoicing === 'asis' ? col('bad') : col('good'));
}
function drawCash(ctx, s) {
  const sus = s.receipts.filter((r) => r.suspense && !r.applied);
  const v = sus.reduce((a, r) => a + r.amount, 0);
  text(ctx, `Suspense list: ${sus.length}`, 608, 398, FB(700, 12), sus.length ? col('warn') : col('ink'));
  if (v) text(ctx, n0(v), 608, 416, FM(12), col('warn'));
  text(ctx, s.controls.cashapp === 'asis' ? 'reviewed "when there is time"' : s.controls.cashapp === 'daily' ? 'reviewed daily' : 'auto-matching', 608, 440, FB(500, 10.5), col('muted'));
}
function drawBank(ctx, s) {
  text(ctx, 'Cash in the bank', 810, 290, FB(600, 11), col('muted'));
  text(ctx, n0(s.cash), 976, 318, FM(19), s.cash < 0 ? col('bad') : col('cash'), 'right');
  const today = s.receipts.filter((r) => s.t - (r.day * 1440 + 600) < 240 && s.t >= r.day * 1440 + 600);
  let y = 345;
  text(ctx, 'Latest receipts', 810, y, FB(600, 10.5), col('muted'));
  for (const r of s.receipts.slice(-5).reverse()) {
    y += 15;
    const fresh = today.includes(r);
    text(ctx, `${r.id} ${D.DEALERS[r.dealer] ? D.DEALERS[r.dealer].short : ''}`, 810, y, FB(fresh ? 700 : 500, 10.5), fresh ? col('cash') : col('ink'));
    text(ctx, n0(r.amount), 976, y, FM(10), r.ref ? col('ink') : col('warn'), 'right');
  }
}
function drawProject(ctx, s) {
  const p = s.project;
  if (!p) { text(ctx, 'No project yet', 96, 290, FB(500, 11), col('muted'), 'center'); return; }
  const P = D.PROJECT;
  text(ctx, `${p.delivered} / ${P.units} units delivered`, 26, 262, FB(600, 10.5), col('ink'));
  rr(ctx, 26, 268, 140, 8, 4); ctx.fillStyle = col('soft'); ctx.fill();
  rr(ctx, 26, 268, 140 * p.delivered / P.units, 8, 4); ctx.fillStyle = col('rev'); ctx.fill();
  text(ctx, `Revenue ${kfmt(p.revenue)}`, 26, 292, FM(10), col('rev'));
  text(ctx, `Advance left ${kfmt(p.liability)}`, 26, 306, FM(10), col('warn'));
  text(ctx, `Owed ${kfmt(p.ar)}`, 26, 320, FM(10), col('ink'));
  text(ctx, `Profit ${kfmt(p.revenue - p.cost)}`, 26, 334, FM(10), col('good'));
}
function drawClose(ctx, s) {
  const c = s.controls;
  text(ctx, c.cutoff === 'checklist' ? 'Cut-off checklist on the last day: ON' : 'Cut-off: early-month invoices are not checked', 26, 396, FB(600, 11), c.cutoff === 'checklist' ? col('good') : col('bad'));
  text(ctx, `Books close on the 3rd of each month. Reports: ${s.reports.length}`, 26, 411, FB(500, 10.5), col('muted'));
  const last = s.reports[s.reports.length - 1];
  if (last) text(ctx, `${last.monthName}: booked ${kfmt(last.booked)} vs earned ${kfmt(last.correct)} · score ${last.score}`, 26, 427, FB(600, 10.5), last.auditFail ? col('bad') : col('good'));
  text(ctx, `Audit strikes: ${s.strikes} / 2`, 26, 443, FB(700, 10.5), s.strikes ? col('bad') : col('muted'));
}
function drawRoles(ctx, s) {
  const split = s.controls.roles === 'split';
  text(ctx, split ? 'Duties split' : 'One clerk does it all', 414, 396, FB(700, 11), split ? col('good') : col('warn'));
  text(ctx, split ? 'Cash: Cash App. Officer' : 'Clerk: invoices + cash +', 414, 411, FB(500, 10.5), col('muted'));
  text(ctx, split ? 'Credit notes: FM approves' : 'credit notes, no approval', 414, 424, FB(500, 10.5), col('muted'));
  text(ctx, `Staff: ${Object.values(s.staff).reduce((a, b) => a + b, 0)}`, 414, 443, FB(600, 10.5), col('ink'));
}
function drawDealers(ctx, s) {
  const d = dayOf(s.t);
  D.DEALER_IDS.forEach((id, i) => {
    const x = 26 + i * 190, y = 488, dd = D.DEALERS[id], dl = s.dealers[id];
    rr(ctx, x, y, 180, 110, 8); ctx.fillStyle = col('soft'); ctx.fill();
    ctx.fillStyle = dd.color; ctx.fillRect(x, y + 6, 4, 22);
    text(ctx, `${id} ${dd.short}`, x + 10, y + 18, FB(700, 12), col('ink'));
    text(ctx, dd.emirate, x + 172, y + 18, FB(500, 10), col('muted'), 'right');
    if (dl.status === 'defaulted') { text(ctx, 'OUT OF BUSINESS', x + 90, y + 66, FB(800, 13), col('bad'), 'center'); return; }
    const bal = dealerBalance(s, id, 'erp'), od = dealerOverdue(s, id, 'erp', d);
    text(ctx, 'Owes (ERP)', x + 10, y + 38, FB(500, 10.5), col('muted'));
    text(ctx, n0(bal), x + 172, y + 38, FM(11), col('ink'), 'right');
    text(ctx, 'Limit (ERP)', x + 10, y + 53, FB(500, 10), col('muted'));
    text(ctx, n0(dl.erpLimit), x + 172, y + 53, FM(11), dl.erpLimit !== dl.approvedLimit ? col('bad') : col('ink'), 'right');
    text(ctx, 'Overdue', x + 10, y + 68, FB(500, 10), col('muted'));
    text(ctx, n0(od), x + 172, y + 68, FM(11), od ? col('bad') : col('ink'), 'right');
    // exposure bar
    const frac = Math.min(1.4, bal / Math.max(1, dl.approvedLimit));
    rr(ctx, x + 10, y + 76, 162, 6, 3); ctx.fillStyle = col('zone'); ctx.fill();
    rr(ctx, x + 10, y + 76, 162 * Math.min(1, frac / 1.4), 6, 3); ctx.fillStyle = frac > 1 ? col('bad') : frac > 0.8 ? col('warn') : col('good'); ctx.fill();
    ctx.fillStyle = col('ink'); ctx.fillRect(x + 10 + 162 / 1.4, y + 73, 1.5, 12);
    text(ctx, 'Happy', x + 10, y + 100, FB(500, 10), col('muted'));
    rr(ctx, x + 48, y + 94, 124, 7, 3); ctx.fillStyle = col('zone'); ctx.fill();
    rr(ctx, x + 48, y + 94, 124 * dl.sat / 100, 7, 3); ctx.fillStyle = dl.sat < 35 ? col('bad') : dl.sat < 55 ? col('warn') : col('good'); ctx.fill();
    hits.push({ kind: 'dealer', id, x, y, w: 180, h: 110 });
  });
}
function drawBooks(ctx, s) {
  const snap = s.daily[s.daily.length - 1];
  if (!snap) return;
  text(ctx, 'Booked by ERP (invoices)', 808, 498, FB(500, 10), col('muted'));
  text(ctx, n0(snap.bookedMTD), 978, 512, FM(12), col('ink'), 'right');
  text(ctx, 'Earned (deliveries)', 808, 530, FB(500, 10), col('muted'));
  text(ctx, n0(snap.trueMTD), 978, 544, FM(12), col('rev'), 'right');
  const gap = snap.trueMTD - snap.bookedMTD;
  text(ctx, 'Gap', 808, 566, FB(500, 10), col('muted'));
  text(ctx, (gap > 0 ? '+' : '') + n0(gap), 978, 580, FM(12), gap ? col('bad') : col('good'), 'right');
  text(ctx, '(as of last night)', 808, 596, FB(500, 9.5), col('muted'));
}

function orderPos(s, o) {
  const z = { inbox: 'inbox', pricing: 'sales', credit: 'erp', held: 'hold', warehouse: 'wh', transit: null }[o.stage];
  if (o.stage === 'pricing' && o.approver === 'SM') return 'sm';
  if (o.stage === 'pricing' && o.approver === 'GMFM') return 'gm';
  return z;
}
function drawOrders(ctx, s, ui) {
  const groups = {};
  for (const o of s.orders) {
    const z = orderPos(s, o);
    if (!z) continue;
    (groups[z] = groups[z] || []).push(o);
  }
  const area = { inbox: [36, 176, 3, 1], sales: [200, 92, 5, 2], sm: [198, 178, 1, 2], gm: [302, 178, 1, 2], erp: [416, 108, 4, 1], hold: [414, 172, 4, 2], wh: [612, 172, 7, 1] };
  for (const [z, list] of Object.entries(groups)) {
    const [x0, y0, cols, rows] = area[z];
    list.slice(-cols * rows).forEach((o, i) => {
      const x = x0 + (i % cols) * 40, y = y0 + Math.floor(i / cols) * 22;
      const bad = o.flags.creditBreach || o.flags.discountBreach || o.flags.intakeError;
      const c = bad ? col('bad') : o.stage === 'held' || o.waitStock ? col('warn') : col('good');
      rr(ctx, x, y, 36, 17, 4); ctx.fillStyle = col('zone'); ctx.fill(); ctx.lineWidth = ui.hoverOrder === o.id ? 2.5 : 1.5; ctx.strokeStyle = c; ctx.stroke();
      ctx.fillStyle = D.DEALERS[o.dealer].color; ctx.fillRect(x + 2, y + 3, 3, 11);
      text(ctx, o.id.slice(2), x + 21, y + 12.5, FM(9.5), col('ink'), 'center');
      hits.push({ kind: 'order', id: o.id, x, y, w: 36, h: 17 });
    });
    if (list.length > cols * rows) text(ctx, `+${list.length - cols * rows}`, x0 + cols * 40 - 4, y0 - 2, FB(700, 10), col('muted'), 'right');
  }
}

function drawTruck(ctx, s) {
  const trips = s.truck.filter((j) => s.t >= j.s && s.t <= j.e);
  const n = Math.max(1, headcount(s, 'DR'));
  const parked = Math.max(0, n - trips.length);
  for (let i = 0; i < parked; i++) truckShape(ctx, 912, 196 - i * 30, '', 1);
  trips.slice(0, 3).forEach((j, i) => {
    const p = (s.t - j.s) / (j.e - j.s);
    let x;
    if (p < 0.35) x = 912 + (p / 0.35) * 110; else if (p < 0.65) x = 1030; else x = 1022 - ((p - 0.65) / 0.35) * 110;
    if (x < 1000) truckShape(ctx, x, 196 - (parked + i) * 30, j.order === 'HOTEL' ? 'HOTEL' : j.order.slice(2), p < 0.5 ? 1 : -1);
  });
  text(ctx, 'to dealers →', 943, 230, FB(600, 10.5), col('muted'), 'center');
}
function truckShape(ctx, x, y, label, dir) {
  ctx.save(); ctx.translate(x, y);
  rr(ctx, 0, 0, 44, 20, 3); ctx.fillStyle = col('bill'); ctx.fill();
  rr(ctx, dir > 0 ? 44 : -14, 6, 14, 14, 3); ctx.fillStyle = col('ink'); ctx.fill();
  ctx.fillStyle = col('ink'); ctx.beginPath(); ctx.arc(10, 21, 4, 0, 7); ctx.arc(36, 21, 4, 0, 7); ctx.fill();
  if (label) text(ctx, label, 22, 14, FM(9), '#fff', 'center');
  ctx.restore();
}

function staffPos(s, role, i) {
  const home = (HOME[role] || [[500, 300]])[i] || HOME[role][0];
  const walk = 15;
  const t = s.t;
  let best = null;
  for (const j of s.jobs) {
    if (j.r !== role || j.i !== i) continue;
    if (t >= j.s - walk && t <= j.e + walk) { best = j; if (t >= j.s && t <= j.e) break; }
  }
  if (!best) return { x: home[0], y: home[1], job: null };
  const spot = SPOT[best.st] || home;
  const off = ((i * 13) % 20) - 10;
  const sx = spot[0] + off, sy = spot[1] + (i % 2) * 8;
  let f;
  if (t < best.s) f = 1 - (best.s - t) / walk; else if (t > best.e) f = 1 - (t - best.e) / walk; else f = 1;
  f = Math.max(0, Math.min(1, f));
  return { x: home[0] + (sx - home[0]) * f, y: home[1] + (sy - home[1]) * f, job: t >= best.s && t <= best.e ? best : null };
}
export const staffHits = [];
function drawStaff(ctx, s, ui) {
  staffHits.length = 0;
  for (const role of D.ROLE_IDS) {
    const n = headcount(s, role);
    const short = role === 'CAO' ? 'CA' : role;
    for (let i = 0; i < n; i++) {
      const p = staffPos(s, role, i);
      const busy = !!p.job;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 7);
      ctx.fillStyle = D.ROLES[role].color; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = busy ? col('warn') : col('zone'); ctx.stroke();
      text(ctx, short, p.x, p.y + 3.5, FB(800, 8.5), '#fff', 'center');
      staffHits.push({ role, i, x: p.x - 11, y: p.y - 11, w: 22, h: 22, job: p.job });
      if (ui.hoverStaff && ui.hoverStaff.role === role && ui.hoverStaff.i === i) {
        const label = `${D.ROLES[role].name}${p.job ? ': ' + p.job.lab : ': free'}`;
        ctx.font = FB(600, 11); const w = ctx.measureText(label).width + 12;
        const bx = Math.min(W - w - 4, Math.max(4, p.x - w / 2));
        rr(ctx, bx, p.y - 34, w, 20, 5); ctx.fillStyle = col('ink'); ctx.fill();
        text(ctx, label, bx + 6, p.y - 20, FB(600, 11), col('bg'));
      }
    }
  }
}

export function hitTest(x, y) {
  for (const h of staffHits) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return { kind: 'staff', ...h };
  for (let k = hits.length - 1; k >= 0; k--) { const h = hits[k]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; }
  for (const z of ZONES) if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return { kind: 'zone', id: z.id, step: z.step, tab: z.tab };
  return null;
}

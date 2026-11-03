// The business engine. Pure logic, no drawing. Event-driven: every action in the company is an
// event at a game time. The same engine runs in the browser and in the Node test.
import * as D from '../data.js?v=6';
import { DAY_START, DAY_END, DAYMIN, tOf, dayOf, minOf, monthOf, monthFirst, monthLast, fmtDay } from './time.js?v=6';
import { computeMonthReport } from './report.js?v=6';
import { buildWeeklyReview, questionById } from './weekly.js?v=6';

// ---------- random numbers (seeded, saved in the state) ----------
export function rand(s) {
  let t = (s.rng = (s.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1));
const pick = (s, arr, w) => {
  const tot = w.reduce((a, b) => a + b, 0); let r = rand(s) * tot;
  for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r < 0) return arr[i]; }
  return arr[arr.length - 1];
};
const n0 = (x) => Math.round(x).toLocaleString('en-US');

// ---------- create ----------
export function createGame({ mode = 'campaign', seed = 20250301, questions = true } = {}) {
  const s = {
    v: 1, mode, seed, rng: seed | 0, t: tOf(0, DAY_START), evSeq: 0, queue: [],
    controls: { ...D.DEFAULT_CONTROLS }, pending: {}, ctlToken: {},
    staff: Object.fromEntries(D.ROLE_IDS.map((r) => [r, D.ROLES[r].base])), hires: [],
    dealers: {}, stock: {}, onOrder: {}, purchases: [],
    orders: [], deliveries: [], invoices: [], receipts: [], creditNotes: [], mdChanges: [], overrides: [],
    expenses: [], cash: D.OPENING_CASH, cap: {}, jobs: [], truck: [], log: [], inbox: [],
    qPending: [], weekReview: null, dynQ: {}, asked: {}, answers: [], reports: [], monthEnd: {}, daily: [], strikes: 0,
    over: null, seq: { inv: 901, dn: 501, r: 1, o: 110, cn: 1, p: 1, pinv: 1 },
    project: null, generated: { 0: true }, settings: { questions }, flags: {}, changeLog: [],
  };
  for (const id of D.DEALER_IDS) {
    const d = D.DEALERS[id];
    s.dealers[id] = { id, erpLimit: d.limit, approvedLimit: d.limit, sat: 70, status: 'active', lastPressure: -99 };
  }
  for (const p of D.PRODUCT_IDS) {
    s.stock[p] = { sys: D.OPENING_STOCK[p].sys, real: D.OPENING_STOCK[p].real, lastCount: null };
    s.onOrder[p] = 0;
  }
  for (const inv of D.OPENING_INVOICES) {
    s.invoices.push({ id: inv.id, dealer: inv.dealer, day: inv.day, amount: inv.amount, qty: null, dn: null, order: null,
      due: inv.day + D.DEALERS[inv.dealer].terms, cn: 0, erpPaid: 0, truePaid: 0, opening: true, writtenOff: 0 });
  }
  for (const o of D.MARCH_ORDERS) schedule(s, tOf(o.day, o.hour * 60), 'ORDER_ARRIVE', { spec: { ...o, scripted: true } });
  for (const r of D.MARCH_OPENING_RECEIPTS) schedule(s, tOf(r.day, 10 * 60), 'RECEIPT', { dealer: r.dealer, amount: r.amount, ref: r.ref, part: !!r.part, scripted: true });
  schedule(s, tOf(D.MARCH_MD_CHANGE.day, 15 * 60), 'MD_CHANGE', { ...D.MARCH_MD_CHANGE, scripted: true });
  const P = D.PROJECT;
  schedule(s, tOf(P.signDay, 10 * 60), 'PROJECT_SIGN', {});
  schedule(s, tOf(P.advanceDay, 11 * 60), 'PROJECT_ADVANCE', {});
  P.deliveries.forEach((dl, i) => schedule(s, tOf(dl.day, 11 * 60), 'PROJECT_DELIVERY', { i }));
  scheduleMonth(s, 0);
  schedule(s, tOf(0, DAY_START), 'DAY_START', {});
  log(s, 'Welcome to Zenith Cooling Supplies. It is 1 March. Nothing has been changed yet: the business runs exactly as described in the case.', 'info');
  return s;
}

function scheduleMonth(s, m) {
  schedule(s, tOf(monthLast(m), DAY_END - 1), 'MONTH_END', { m });
  schedule(s, tOf(monthFirst(m + 1) + 2, DAY_START) + 1, 'MONTH_CLOSE', { m });
}

// ---------- event queue ----------
export function schedule(s, t, type, data) {
  const ev = { t, k: s.evSeq++, type, ...data };
  const q = s.queue;
  let lo = 0, hi = q.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; const a = q[mid]; if (a.t < t || (a.t === t && a.k < ev.k)) lo = mid + 1; else hi = mid; }
  q.splice(lo, 0, ev);
  return ev;
}

// Advance the business to time target, firing every event on the way.
export function advanceTo(s, target) {
  while (!s.over && s.queue.length && s.queue[0].t <= target) {
    const ev = s.queue.shift();
    s.t = Math.max(s.t, ev.t);
    const h = HANDLERS[ev.type];
    if (h) h(s, ev);
  }
  if (!s.over) s.t = Math.max(s.t, target);
}
// Next moment the clock should jump to after the working day ends.
export function nextWorkTime(t) {
  const m = minOf(t);
  if (m >= DAY_END) return tOf(dayOf(t) + 1, DAY_START);
  if (m < DAY_START) return tOf(dayOf(t), DAY_START);
  return t;
}
export function skipToNextClose(s) {
  const ev = s.queue.find((e) => e.type === 'MONTH_CLOSE');
  if (ev) advanceTo(s, ev.t);
}
export function skipDay(s) { advanceTo(s, tOf(dayOf(s.t) + 1, DAY_START)); }

// ---------- helpers ----------
export function log(s, text, kind = 'info', extra = {}) {
  s.log.push({ t: s.t, text, kind, ...extra });
  if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
}
function olog(s, o, text, money) { o.log.push({ t: s.t, text, money: money || null }); }
function ask(s, id) {
  if (s.asked[id]) return;
  s.asked[id] = true;
  s.qPending.push(id);
}
const C = (s) => s.controls;
export const headcount = (s, role) => s.staff[role] || 0;
function roleFor(s, role) {
  if (role === 'CAO' && (headcount(s, 'CAO') === 0 || C(s).roles !== 'split')) return 'BC';
  if (role === 'CR' && headcount(s, 'CR') === 0) return 'FM';
  return role;
}
// Book work for a role. Returns the time the work is done. Fills each person's 10-hour day.
export function book(s, role0, hours, t0, station, label) {
  const role = roleFor(s, role0);
  const n = Math.max(1, headcount(s, role));
  let d = dayOf(t0), m = minOf(t0);
  if (m < DAY_START) m = DAY_START;
  if (m >= DAY_END) { d++; m = DAY_START; }
  const cap = (DAY_END - DAY_START) / 60;
  for (let guard = 0; guard < 400; guard++) {
    // least-busy person; ties rotate so work is shared (SE1, SE2, SE1, ...)
    s.rr = s.rr || {};
    const first = (s.rr[role] || 0) % n;
    let best = first, bestUsed = 1e9;
    for (let k = 0; k < n; k++) { const i = (first + k) % n; const u = s.cap[role + i + ':' + d] || 0; if (u < bestUsed) { best = i; bestUsed = u; } }
    const start = Math.max(m, DAY_START + bestUsed * 60);
    if (bestUsed + hours <= cap + 0.01 && start + hours * 60 <= DAY_END + 0.5) {
      s.cap[role + best + ':' + d] = (start - DAY_START) / 60 + hours;
      s.lastStaff = best;
      s.rr[role] = best + 1;
      const st = tOf(d, start), en = tOf(d, start + hours * 60);
      if (hours > 0) s.jobs.push({ r: role, i: best, st: station, s: st, e: en, lab: label });
      return en;
    }
    d++; m = DAY_START;
  }
  return tOf(d, DAY_START);
}
export function expense(s, type, amount, label) {
  s.cash -= amount;
  s.expenses.push({ day: dayOf(s.t), type, amount, label });
}
function income(s, amount) { s.cash += amount; }
function sat(s, dealer, delta) {
  const d = s.dealers[dealer]; if (!d) return;
  d.sat = Math.max(0, Math.min(100, d.sat + delta));
}
const orderById = (s, id) => s.orders.find((o) => o.id === id);
const scriptOn = (o) => o.scripted;

// ---------- balances: the ERP view and the policy ("true") view ----------
function invOpen(inv, view) { return inv.amount - inv.cn - inv.writtenOff - (view === 'erp' ? inv.erpPaid : inv.truePaid); }
export function dealerBalance(s, dealer, view) {
  let b = 0;
  for (const inv of s.invoices) if (inv.dealer === dealer && !inv.project) b += invOpen(inv, view);
  return b;
}
export function dealerOverdue(s, dealer, view, day) {
  let b = 0;
  for (const inv of s.invoices) if (inv.dealer === dealer && !inv.project && day > inv.due) b += Math.max(0, invOpen(inv, view));
  return b;
}
export function oldestOverdueDays(s, dealer, day) {
  let worst = 0;
  for (const inv of s.invoices) if (inv.dealer === dealer && !inv.project && day > inv.due && invOpen(inv, 'true') > 0) worst = Math.max(worst, day - inv.due);
  return worst;
}
// Allocate a payment to a dealer's invoices: named invoice first, then oldest first.
function allocate(s, dealer, amount, ref, field) {
  const list = s.invoices.filter((i) => i.dealer === dealer && !i.project).sort((a, b) => a.day - b.day);
  const out = [];
  const take = (inv) => {
    const open = inv.amount - inv.cn - inv.writtenOff - inv[field];
    const a = Math.min(open, amount);
    if (a > 0) { inv[field] += a; amount -= a; out.push({ inv: inv.id, amt: a }); }
  };
  if (ref) { const inv = list.find((i) => i.id === ref); if (inv) take(inv); }
  for (const inv of list) { if (amount <= 0) break; take(inv); }
  return out;
}

// ---------- policy checks ----------
const RANK = { none: 0, SE: 1, SM: 2, GMFM: 3 };
export function requiredApproverP2(disc) { return disc <= 0 ? 'none' : disc <= 0.05 ? 'SE' : disc <= 0.10 ? 'SM' : 'GMFM'; }
function requiredByWorkflow(s, disc) {
  if (C(s).pricing === 'custom') {
    const t1 = C(s).th1 / 100, t2 = C(s).th2 / 100;
    return disc <= 0 ? 'none' : disc <= t1 ? 'SE' : disc <= t2 ? 'SM' : 'GMFM';
  }
  return requiredApproverP2(disc);
}
export function creditView(s, o, view) {
  const dealer = s.dealers[o.dealer];
  const bal = dealerBalance(s, o.dealer, view === 'erp' ? 'erp' : 'true');
  const overdue = dealerOverdue(s, o.dealer, view === 'erp' ? 'erp' : 'true', dayOf(s.t));
  const limit = view === 'erp' ? dealer.erpLimit : dealer.approvedLimit;
  const exposure = bal + o.value;
  return { bal, overdue, limit, exposure, fail: exposure > limit || overdue > 0 };
}

// ---------- generated months ----------
const BASE_ORDERS = [9, 12, 14, 16, 17, 16, 14, 12, 11, 10, 10, 11];
function generateMonth(s, m) {
  if (s.generated[m]) return;
  s.generated[m] = true;
  const first = monthFirst(m), last = monthLast(m);
  const active = D.DEALER_IDS.filter((id) => s.dealers[id].status === 'active');
  if (!active.length) return;
  const satF = (id) => { const x = s.dealers[id].sat; return x < 15 ? 0.4 : x < 35 ? 0.7 : x > 85 ? 1.15 : 1; };
  const weights = active.map((id) => D.DEALERS[id].weight * satF(id));
  const avgF = weights.reduce((a, b) => a + b, 0) / active.reduce((a, id) => a + D.DEALERS[id].weight, 0);
  let count = Math.round(BASE_ORDERS[m % 12] * (C(s).volume / 100) * Math.max(0.3, avgF) * (active.length / 4 * 0.5 + 0.5));
  if (weights.every((w) => w === 0)) count = 0;
  for (let i = 0; i < count; i++) {
    const dealer = pick(s, active, weights);
    const dd = D.DEALERS[dealer];
    const product = pick(s, D.PRODUCT_IDS, [35, 40, 25]);
    const r = rand(s);
    const disc = r < 0.68 ? 0 : r < 0.82 ? ri(s, 2, 5) / 100 : r < 0.94 ? ri(s, 6, 10) / 100 : ri(s, 11, 15) / 100;
    const spec = { id: 'O-' + s.seq.o++, day: ri(s, first, last), hour: ri(s, 9, 15), dealer, product,
      qty: ri(s, dd.qMin, dd.qMax), disc, sePush: rand(s) < 0.6, scripted: false, script: {} };
    schedule(s, tOf(spec.day, spec.hour * 60 + ri(s, 0, 50)), 'ORDER_ARRIVE', { spec });
  }
  log(s, `${count} dealer orders expected in ${monthShortName(m)} (volume ${C(s).volume}%).`, 'info');
}
const monthShortName = (m) => fmtDay(monthFirst(m)).split('-')[1];

// ---------- handlers ----------
const HANDLERS = {
  DAY_START(s) {
    const d = dayOf(s.t);
    const m = monthOf(d);
    if (d === monthFirst(m) && m >= 1) { generateMonth(s, m); scheduleMonth(s, m); }
    // prune old capacity and jobs
    if (d % 3 === 0) {
      for (const k of Object.keys(s.cap)) if (+k.split(':')[1] < d - 1) delete s.cap[k];
    }
    s.jobs = s.jobs.filter((j) => j.e > s.t - 240);
    s.truck = s.truck.filter((j) => j.e > s.t - 240);
    for (const id of D.DEALER_IDS) { const dl = s.dealers[id]; dl.sat += (70 - dl.sat) * 0.04; }
    // held orders
    for (const o of s.orders) {
      if (o.stage !== 'held') continue;
      sat(s, o.dealer, -0.7);
      if (d - o.heldDay >= 10) {
        o.stage = 'cancelled'; o.cancelDay = d; sat(s, o.dealer, -6);
        olog(s, o, `${D.DEALERS[o.dealer].short} cancelled the order after waiting 10 days on credit hold. Lost sale of ${n0(o.value)}.`);
        log(s, `${o.id} cancelled by ${D.DEALERS[o.dealer].short} after 10 days on hold.`, 'bad', { order: o.id });
        continue;
      }
      if (o.fmDecided) {
        const erp = creditView(s, o, 'erp');
        if (!erp.fail) release(s, o, 'ERP', 'Credit re-check passed after payments');
      }
    }
    // weekly routines (every 7th day)
    if (d % 7 === 6) weekly(s, d);
    // daily suspense review
    if (C(s).cashapp !== 'asis') reviewSuspense(s, C(s).cashapp === 'auto' ? 0.97 : 0.9);
    // stock losses nobody records (from April)
    if (d >= 31 && rand(s) < 0.07) {
      const p = pick(s, D.PRODUCT_IDS, [1, 1, 1]);
      if (s.stock[p].real > 0) {
        s.stock[p].real -= 1;
        s.expenses.push({ day: d, type: 'stockloss', amount: D.PRODUCTS[p].cost, label: '1 × ' + p + ' damaged or missing' });
        if (C(s).count === 'scan') { s.stock[p].sys -= 1; log(s, `Scanner recorded 1 × ${p} damaged in the warehouse.`, 'warn'); checkReorder(s, p); }
      }
    }
    // Sky Home pays when its orders are blocked
    const d2 = s.dealers.D2;
    if (d >= 31 && d2.status === 'active' && d - d2.lastPressure > 10 && dealerOverdue(s, 'D2', 'true', d) > 0 &&
      s.orders.some((o) => o.dealer === 'D2' && o.stage === 'held')) {
      d2.lastPressure = d;
      if (rand(s) < 0.7) {
        const amt = dealerOverdue(s, 'D2', 'true', d);
        schedule(s, tOf(d + ri(s, 3, 8), 11 * 60), 'RECEIPT', { dealer: 'D2', amount: amt, ref: oldestOpen(s, 'D2'), part: false });
        log(s, `Sky Home promises to clear its overdue ${n0(amt)} because its order is blocked. (A promise is not cash: nothing is counted yet.)`, 'info');
      }
    }
    schedule(s, tOf(d, 16 * 60), 'INVOICE_RUN', {});
    schedule(s, tOf(d, DAY_END), 'DAY_END', {});
    schedule(s, tOf(d + 1, DAY_START), 'DAY_START', {});
  },

  DAY_END(s) {
    const d = dayOf(s.t);
    s.daily.push(snapshot(s, d));
    if (d % 7 === 6 && s.settings.questions) buildWeeklyReview(s, d);
    if (s.daily.length > 800) s.daily.shift();
    if (s.mode === 'campaign' && s.cash < 0) {
      s.over = { result: 'lose', reason: `Cash in the bank fell below zero on ${fmtDay(d)}. Zenith could not pay its bills.` };
      log(s, s.over.reason, 'bad');
    }
  },

  ORDER_ARRIVE(s, ev) {
    const sp = ev.spec;
    const p = D.PRODUCTS[sp.product];
    const o = { id: sp.id, dealer: sp.dealer, product: sp.product, qty: sp.qty, intendedQty: sp.qty, disc: sp.disc,
      price: Math.round(p.list * (1 - sp.disc)), sePush: sp.sePush, scripted: !!sp.scripted, script: sp.script || {},
      requestedDay: sp.requestedDay ?? null, day: dayOf(s.t), arriveT: s.t, stage: 'inbox', channel: C(s).intake,
      log: [], dns: [], delivered: 0, backorder: 0, flags: {}, waitH: 0 };
    o.value = o.price * o.qty;
    s.orders.push(o);
    const dd = D.DEALERS[o.dealer];
    const msg = `${dd.short}: Please send ${o.qty} × ${o.product} (${p.name})${o.disc ? `, ${Math.round(o.disc * 100)}% discount as agreed` : ''}.`;
    s.inbox.push({ t: s.t, dealer: o.dealer, order: o.id, text: msg, channel: o.channel });
    if (s.inbox.length > 60) s.inbox.shift();
    olog(s, o, `Order received by ${o.channel === 'portal' ? 'dealer portal' : o.channel === 'form' ? 'order template' : 'WhatsApp'}: ${o.qty} × ${o.product} at ${n0(o.price)} = ${n0(o.value)}.`,
      ['Nothing is booked. An order is a promise: no revenue, no receivable, no cash. Stock is only reserved.']);
    log(s, `New order ${o.id} from ${dd.short}: ${o.qty} × ${o.product} (${n0(o.value)}).`, 'order', { order: o.id });
    ask(s, 'first_order');
    // intake
    let enterH = o.channel === 'whatsapp' ? 0.5 : o.channel === 'form' ? 0.3 : 0;
    let delay = o.channel === 'whatsapp' ? 60 : o.channel === 'form' ? 20 : 0;
    if (!o.scripted) {
      const errP = o.channel === 'whatsapp' ? 0.04 : o.channel === 'form' ? 0.01 : 0;
      const lostP = o.channel === 'whatsapp' ? 0.02 : 0;
      if (rand(s) < lostP) {
        delay += DAYMIN; o.flags.lostMsg = true; sat(s, o.dealer, -3);
        olog(s, o, 'The WhatsApp message was missed. The dealer chased it the next day.');
      }
      if (rand(s) < errP) {
        o.qty = o.intendedQty + 2; o.value = o.price * o.qty; o.flags.intakeError = true;
        olog(s, o, `Typing error: entered ${o.qty} instead of ${o.intendedQty}.`);
      }
    }
    if (o.channel === 'portal') sat(s, o.dealer, 0.5);
    const done = enterH ? book(s, 'SE', enterH, s.t + delay, 'inbox', 'Enter ' + o.id) : s.t + delay;
    if (enterH) {
      o.se = s.lastStaff;
      olog(s, o, `SE${o.se + 1} (Sales Executive ${o.se + 1}) takes the order and types it into the ERP.`);
      log(s, `SE${o.se + 1} takes ${o.id} from ${dd.short}.`, 'info', { order: o.id });
    }
    schedule(s, done, 'ORDER_ENTERED', { order: o.id });
  },

  ORDER_ENTERED(s, ev) {
    const o = orderById(s, ev.order);
    o.stage = 'pricing'; o.enterT = s.t;
    // pricing and discount
    let reqWf = C(s).pricing === 'asis' ? null : requiredByWorkflow(s, o.disc);
    const reqP2 = requiredApproverP2(o.disc);
    if (C(s).floorBlock === 'on' && C(s).pricing !== 'asis' && o.disc > 0.10) {
      const old = o.disc; o.disc = 0.10; o.price = Math.round(D.PRODUCTS[o.product].list * 0.9); o.value = o.price * o.qty;
      sat(s, o.dealer, -4);
      olog(s, o, `Floor-price block: discount cut from ${Math.round(old * 100)}% to 10%.`);
      if (!o.scripted && rand(s) < 0.2) {
        o.stage = 'cancelled'; o.cancelDay = dayOf(s.t);
        olog(s, o, 'Dealer cancelled: unhappy with the lower discount.');
        log(s, `${o.id} cancelled: dealer refused the capped discount.`, 'warn', { order: o.id });
        return;
      }
      reqWf = requiredByWorkflow(s, o.disc);
    }
    let approver, t = s.t;
    if (o.disc <= 0) approver = 'none';
    else if (!reqWf) {
      // today: nobody enforces approval
      if (o.scripted && o.script.approver) approver = o.script.approver;
      else if (reqP2 === 'SE') approver = 'SE';
      else approver = rand(s) < 0.5 ? 'SE' : reqP2;
    } else approver = reqWf;
    if (approver === 'SE') t = book(s, 'SE', 0.1, t, 'sales', 'Discount ' + o.id);
    if (approver === 'SM') t = book(s, 'SM', 0.3, t + 60, 'sm', 'Approve discount ' + o.id);
    if (approver === 'GMFM') { t = book(s, 'GM', 0.3, t + 120, 'gm', 'Approve discount ' + o.id); t = book(s, 'FM', 0.3, t, 'fm', 'Approve discount ' + o.id); }
    o.approver = approver; o.reqApprover = reqP2;
    o.flags.discountBreach = RANK[approver] < RANK[reqP2];
    const floor = D.PRODUCTS[o.product].floor;
    o.belowFloor = Math.max(0, floor - o.price) * o.qty;
    if (o.disc > 0) {
      const names = { SE: 'Sales Executive', SM: 'Sales Manager', GMFM: 'General Manager + Finance Manager' };
      olog(s, o, `Discount ${Math.round(o.disc * 100)}% approved by ${names[approver]} (policy P2 needs ${names[reqP2]}).${o.flags.discountBreach ? ' BREACH.' : ''}${o.belowFloor ? ` Sold ${n0(o.belowFloor)} below floor price.` : ''}`);
      if (o.flags.discountBreach) log(s, `${o.id}: ${Math.round(o.disc * 100)}% discount approved by a ${names[approver]} only (P2 breach).`, 'bad', { order: o.id });
    }
    schedule(s, t, 'CREDIT_CHECK', { order: o.id });
  },

  CREDIT_CHECK(s, ev) {
    const o = orderById(s, ev.order);
    if (o.stage === 'cancelled') return;
    o.stage = 'credit';
    const pol = creditView(s, o, 'true');
    let erp = creditView(s, o, 'erp');
    o.policyHold = pol.fail;
    o.credit = { pol, erp };
    const mode = C(s).credit;
    // Today a Sales Executive may raise the limit to make the warning go away
    if (!o.scripted && erp.fail && erp.overdue === 0 && o.sePush && C(s).md === 'asis' && rand(s) < 0.3) {
      const to = Math.ceil(erp.exposure / 5000) * 5000;
      mdChange(s, { dealer: o.dealer, from: s.dealers[o.dealer].erpLimit, to });
      erp = creditView(s, o, 'erp'); o.credit.erp = erp;
    }
    const txt = (v) => `balance ${n0(v.bal)} + order ${n0(o.value)} = exposure ${n0(v.exposure)} vs limit ${n0(v.limit)}${v.overdue ? `; ${n0(v.overdue)} overdue` : ''}`;
    olog(s, o, `Credit check. ERP: ${txt(erp)} → ${erp.fail ? 'FAILS' : 'passes'}. Policy P1 (approved limit, all cash received): ${txt(pol)} → ${pol.fail ? 'HOLD' : 'release'}.`);
    if (!erp.fail) { release(s, o, 'SE', 'ERP showed no warning'); return; }
    if (mode === 'warning') {
      if (o.sePush) {
        const t = book(s, 'SE', 0.1, s.t, 'erp', 'Release ' + o.id);
        schedule(s, t, 'RELEASE', { order: o.id, by: 'SE', why: 'Warning shown; released by Sales Executive' });
        return;
      }
      hold(s, o, 2 * DAYMIN);
    } else if (mode === 'hardstop') hold(s, o, DAYMIN);
    else hold(s, o, 4 * 60);
  },

  RELEASE(s, ev) { const o = orderById(s, ev.order); if (o.stage === 'credit' || o.stage === 'held') release(s, o, ev.by, ev.why); },

  FM_REVIEW(s, ev) {
    const o = orderById(s, ev.order);
    if (o.stage !== 'held') return;
    const pol = creditView(s, o, 'true');
    o.fmDecided = true;
    if (pol.overdue === 0 && pol.exposure <= 1.25 * pol.limit) {
      const documented = C(s).credit !== 'warning' || o.scripted || rand(s) < 0.8;
      s.overrides.push({ order: o.id, day: dayOf(s.t), reason: 'Large seasonal order; dealer pays on time', expiry: dayOf(s.t) + 30, documented });
      o.override = true;
      olog(s, o, `Finance Manager override: no overdue, exposure ${n0(pol.exposure)} within 125% of the ${n0(pol.limit)} limit. Reason and 30-day expiry ${documented ? 'recorded' : 'NOT recorded'}.`);
      release(s, o, 'FM', 'Finance Manager override');
    } else {
      olog(s, o, `Finance Manager keeps the hold: ${pol.overdue ? n0(pol.overdue) + ' overdue' : 'exposure ' + n0(pol.exposure) + ' too far over limit'}. Released automatically once the dealer pays.`);
      log(s, `${o.id} stays on credit hold (Finance Manager).`, 'warn', { order: o.id });
      if (o.dealer === 'D2') ask(s, 'promise');
      else if (!pol.overdue) olog(s, o, 'Tip: this dealer has nothing overdue. If it is a good payer, its approved limit may be too low for its sales (Customer master data).');
    }
  },

  SHIP(s, ev) {
    const o = orderById(s, ev.order);
    const want = ev.qty;
    const st = s.stock[o.product];
    const shipQty = Math.max(0, Math.min(want, st.real));
    if (shipQty === 0) {
      // empty shelf: the order waits; after 3 days the warehouse raises an emergency reorder
      o.stage = 'warehouse'; o.waitStock = (o.waitStock || 0) + 1; sat(s, o.dealer, -0.5);
      if (o.waitStock === 1) { olog(s, o, `No ${o.product} on the shelf (the ERP shows ${st.sys}). Order waiting for stock.`); log(s, `${o.id}: no ${o.product} on the shelf although the ERP shows ${st.sys}. Waiting for stock.`, 'bad', { order: o.id }); }
      if (o.waitStock === 3 && s.onOrder[o.product] === 0) {
        st.sys = st.real; st.lastCount = { day: dayOf(s.t), real: st.real };
        log(s, `Warehouse escalates: ${o.product} shelf is empty. ERP corrected to ${st.real} and an emergency reorder placed.`, 'warn');
        checkReorder(s, o.product);
      }
      o.waitH += 10;
      schedule(s, tOf(dayOf(s.t) + 1, 10 * 60), 'SHIP', { order: o.id, qty: want });
      return;
    }
    o.waitStock = 0;
    st.real -= shipQty;
    const untracked = C(s).shortage === 'untracked' && C(s).count !== 'scan';
    st.sys = Math.max(0, st.sys - (untracked ? want : shipQty));
    if (C(s).count === 'scan') st.sys = st.real;
    checkReorder(s, o.product);
    if (shipQty < want) {
      if (C(s).shortage === 'backorder' || C(s).count === 'scan') {
        o.backorder += want - shipQty;
        olog(s, o, `Only ${shipQty} of ${want} in stock. ${want - shipQty} put on back-order; dealer informed.`);
        log(s, `${o.id}: short ${want - shipQty} × ${o.product}, back-order recorded.`, 'warn', { order: o.id });
        sat(s, o.dealer, -1);
      } else {
        o.flags.shortUntracked = true;
        olog(s, o, `Only ${shipQty} of ${want} on the shelf. Shipped ${shipQty}. Nobody recorded the gap: the ERP still deducted ${want}.`);
        log(s, `${o.id}: warehouse shipped ${shipQty} of ${want} × ${o.product}; shortage not recorded.`, 'bad', { order: o.id });
        sat(s, o.dealer, -4);
      }
    }
    o.stage = 'transit';
    s.truck.push({ s: s.t, e: s.t + 300, order: o.id, dealer: o.dealer });
    schedule(s, s.t + 180, 'DELIVER', { order: o.id, qty: shipQty });
  },

  DELIVER(s, ev) {
    const o = orderById(s, ev.order);
    let qty = ev.qty;
    let refused = 0;
    if (o.flags.intakeError && o.delivered + qty > o.intendedQty) {
      refused = o.delivered + qty - o.intendedQty; qty -= refused;
      s.stock[o.product].real += refused; s.stock[o.product].sys += C(s).count === 'scan' || C(s).shortage === 'backorder' ? refused : 0;
      sat(s, o.dealer, -5);
      olog(s, o, `Dealer refused ${refused} extra units (they only ordered ${o.intendedQty}). Goods returned to the warehouse.`);
    }
    if (qty <= 0) return;
    const d = dayOf(s.t);
    const dn = { dn: 'DN-' + s.seq.dn++, order: o.id, dealer: o.dealer, product: o.product, day: d, qty, price: o.price,
      value: qty * o.price, cost: qty * D.PRODUCTS[o.product].cost, podDay: null, inv: null, missed: false, month: monthOf(d) };
    s.deliveries.push(dn);
    o.dns.push(dn.dn); o.delivered += qty; o.stage = 'delivered';
    if (!o.flags.shortUntracked && !refused) sat(s, o.dealer, 1);
    olog(s, o, `${dn.dn} signed by the dealer: ${qty} × ${o.product} delivered.`, [
      `Revenue earned now: +${n0(dn.value)} (control passed to the dealer).`, `Receivable +${n0(dn.value)} (they owe us).`,
      `Stock −${qty}; cost of goods +${n0(dn.cost)}. Profit on this delivery ${n0(dn.value - dn.cost)}.`, 'No cash yet.']);
    log(s, `${dn.dn}: ${qty} × ${o.product} delivered to ${D.DEALERS[o.dealer].short} (${o.id}).`, 'good', { order: o.id });
    ask(s, 'first_delivery');
    // proof of delivery
    const pod = C(s).pod;
    const podDelay = pod === 'paper' ? (o.scripted ? 2 : ri(s, 1, 3)) : 0;
    schedule(s, pod === 'paper' ? tOf(d + podDelay, 9 * 60) : s.t + 60, 'POD_BACK', { dn: dn.dn });
    // invoicing plan
    if (C(s).invoicing === 'asis') {
      if (o.scripted && o.dns.length === 1 && (o.script.invoiceDay != null || o.script.invoiceMissed)) {
        if (o.script.invoiceMissed) { dn.missed = true; }
        else schedule(s, tOf(o.script.invoiceDay, 16 * 60), 'INVOICE_ONE', { dn: dn.dn, scriptedInv: true });
      } else if (rand(s) < 0.08 && !o.scripted) dn.missed = true;
    } else if (C(s).invoicing === 'auto') {
      schedule(s, s.t + 30, 'INVOICE_ONE', { dn: dn.dn, auto: true });
    } else if (!o.scripted && rand(s) < (C(s).invoicing === 'daily' ? 0.01 : 0.03)) dn.missed = true;
    if (dn.missed) olog(s, o, `${dn.dn} was left out of the billing batch. Nobody noticed.`);
    if (o.id === 'O-108' && monthOf(d) === 0) ask(s, 'cutoff');
    // back-orders can ship when stock arrives
  },

  POD_BACK(s, ev) {
    const dn = s.deliveries.find((x) => x.dn === ev.dn);
    dn.podDay = dayOf(s.t);
    const o = orderById(s, dn.order);
    olog(s, o, `Signed note ${dn.dn} reached the office (${C(s).pod === 'paper' ? 'paper, via driver' : 'electronic'}).`);
  },

  INVOICE_RUN(s) {
    const d = dayOf(s.t);
    const mode = C(s).invoicing;
    const batchDay = d % 3 === 2;
    if (mode === 'auto') return;
    if (mode !== 'daily' && !batchDay) return;
    let n = 0;
    for (const dn of s.deliveries) {
      if (dn.inv || dn.missed || dn.lost) continue;
      const o = orderById(s, dn.order);
      if (C(s).invoicing === 'asis' && o.scripted && o.script.invoiceDay != null && o.dns[0] === dn.dn) continue;
      if (mode !== 'asis' && dn.podDay == null) continue;
      if (dn.day > d) continue;
      createInvoice(s, dn, mode === 'asis' ? 'order' : 'dn');
      n++;
    }
    if (n) log(s, `Billing ran a ${mode === 'daily' ? 'daily' : 'batch'} invoice run: ${n} invoice${n > 1 ? 's' : ''}.`, 'info');
  },

  INVOICE_ONE(s, ev) {
    const dn = s.deliveries.find((x) => x.dn === ev.dn);
    if (dn.inv || dn.lost) return;
    createInvoice(s, dn, ev.auto ? 'dn' : (C(s).invoicing === 'asis' ? 'order' : 'dn'), ev.auto ? dn.day : null);
  },

  DISPUTE(s, ev) {
    const inv = s.invoices.find((i) => i.id === ev.inv);
    const extra = inv.amount - inv.cn - ev.correct;
    if (extra <= 0 || inv.writtenOff) return;
    inv.dispute = true;
    sat(s, inv.dealer, -5);
    log(s, `${D.DEALERS[inv.dealer].short} disputes ${inv.id}: billed ${n0(inv.amount)} but only ${n0(ev.correct)} was delivered.`, 'bad');
    const o = orderById(s, inv.order);
    if (o) olog(s, o, `Dealer disputes ${inv.id}: over-billed by ${n0(extra)}.`);
    ask(s, 'over_billing');
    const days = C(s).monitoring === 'dashboard' ? 3 : C(s).monitoring === 'weekly' ? 7 : 15;
    schedule(s, tOf(dayOf(s.t) + days + (C(s).roles === 'split' ? 1 : 0), 14 * 60), 'CREDIT_NOTE', { inv: inv.id, amount: extra, reason: 'Over-billing dispute' });
  },

  CREDIT_NOTE(s, ev) {
    const inv = s.invoices.find((i) => i.id === ev.inv);
    const open = inv.amount - inv.cn - inv.writtenOff;
    const amt = Math.min(ev.amount, open + inv.erpPaid * 0); // can credit up to invoice value
    if (amt <= 0 || !inv.dispute && !ev.hidden && !ev.checklist) return;
    inv.cn += amt; inv.dispute = false;
    const cn = { id: 'CN-' + String(s.seq.cn++).padStart(3, '0'), inv: inv.id, dealer: inv.dealer, day: dayOf(s.t), amount: amt, reason: ev.reason, hidden: !!ev.hidden };
    s.creditNotes.push(cn);
    book(s, C(s).roles === 'split' ? 'FM' : 'BC', 0.3, s.t, C(s).roles === 'split' ? 'fm' : 'billing', 'Credit note ' + inv.id);
    if (ev.hidden) {
      s.expenses.push({ day: dayOf(s.t), type: 'writeoff_hidden', amount: amt, label: `Unapproved credit note ${cn.id} on ${inv.id}` });
      log(s, `${cn.id}: the Billing Clerk issued a ${n0(amt)} credit note to ${D.DEALERS[inv.dealer].short} with no approval.`, 'warn');
    } else {
      sat(s, inv.dealer, 3);
      log(s, `${cn.id} issued on ${inv.id} for ${n0(amt)} (${ev.reason}).`, 'info');
      ask(s, 'credit_note');
    }
    // fix any pending payment so the dealer pays the corrected amount
  },

  RECEIPT(s, ev) {
    const dl = s.dealers[ev.dealer];
    if (dl.status === 'defaulted') return;
    if (ev.inv) { const inv = s.invoices.find((i) => i.id === ev.inv); if (inv && ev.token !== inv.payToken) return; }
    let amount = ev.amount;
    if (ev.inv) { const inv = s.invoices.find((i) => i.id === ev.inv); amount = Math.min(amount, Math.max(0, inv.amount - inv.cn - inv.writtenOff - inv.truePaid)); }
    if (amount <= 0) return;
    let ref = ev.ref;
    if (!ref && C(s).askRefs === 'on' && ev.intended && (ev.scripted || rand(s) < 0.85)) ref = ev.intended;
    const r = { id: 'R-' + s.seq.r++, day: dayOf(s.t), dealer: ev.dealer, amount, ref: ref || null, part: !!ev.part,
      applied: false, appliedDay: null, alloc: [] };
    s.receipts.push(r);
    income(s, amount);
    r.alloc = allocate(s, ev.dealer, amount, ref, 'truePaid');
    log(s, `${r.id}: ${n0(amount)} received in the bank from ${D.DEALERS[ev.dealer].short}${ref ? ` (ref ${ref}${ev.part ? ', part payment' : ''})` : ' with NO reference'}.`, 'cash');
    for (const a of r.alloc) { const inv = s.invoices.find((i) => i.id === a.inv); const o = inv && inv.order && orderById(s, inv.order);
      if (o) olog(s, o, `${r.id}: ${n0(a.amt)} reached the bank for ${inv.id}.`, [`Cash +${n0(a.amt)} (counted now: it is in the bank).`, ref ? 'Receivable cleared once the clerk applies it.' : 'No reference: goes to suspense; the ERP still shows the dealer owing this.']); }
    if (r.id === 'R-1') ask(s, 'first_receipt');
    if (ev.part) ask(s, 'part_payment');
    const mode = C(s).cashapp;
    if (ref) {
      const delay = mode === 'auto' ? 10 : mode === 'daily' ? 120 : (ev.scripted ? 60 : DAYMIN);
      const t = mode === 'auto' ? s.t + delay : book(s, 'CAO', 0.3, s.t + delay, 'cash', 'Apply ' + r.id);
      schedule(s, t, 'APPLY', { r: r.id });
    } else {
      r.suspense = true;
      log(s, `${r.id} put on the suspense list.`, 'warn');
      ask(s, 'suspense');
      if (mode === 'auto' && rand(s) < 0.85) schedule(s, s.t + 30, 'APPLY', { r: r.id });
    }
  },

  APPLY(s, ev) {
    const r = s.receipts.find((x) => x.id === ev.r);
    if (r.applied) return;
    r.applied = true; r.appliedDay = dayOf(s.t); r.suspense = false;
    allocate(s, r.dealer, r.amount, r.ref, 'erpPaid');
  },

  MD_CHANGE(s, ev) { mdChange(s, ev); },

  STOCK_ARRIVE(s, ev) {
    const st = s.stock[ev.product];
    st.real += ev.qty; st.sys += ev.qty; s.onOrder[ev.product] -= ev.qty;
    if (C(s).count === 'scan') st.sys = st.real;
    expense(s, 'purchase', ev.qty * D.PRODUCTS[ev.product].cost, `${ev.qty} × ${ev.product} from the manufacturer`);
    log(s, `Delivery from the manufacturer: ${ev.qty} × ${ev.product} (paid ${n0(ev.qty * D.PRODUCTS[ev.product].cost)}).`, 'info');
    // ship back-orders
    for (const o of s.orders) {
      if (o.backorder > 0 && o.product === ev.product) {
        const q = o.backorder; o.backorder = 0;
        schedule(s, tOf(dayOf(s.t) + 1, 10 * 60), 'SHIP', { order: o.id, qty: q, back: true });
      }
    }
  },

  CONTROL_LIVE(s, ev) {
    if (s.ctlToken[ev.key] !== ev.token) return;
    s.controls[ev.key] = ev.value;
    delete s.pending[ev.key];
    const st = D.STEPS.find((x) => x.controls.some((c) => c.key === ev.key));
    const opt = findOption(ev.key, ev.value);
    log(s, `Change is live: ${st.name}: ${opt ? opt.label : ev.value}.`, 'good');
    s.changeLog.push({ day: dayOf(s.t), key: ev.key, value: ev.value, live: true });
    if (ev.key === 'intake' && ev.value === 'portal') for (const id of D.DEALER_IDS) sat(s, id, 5);
  },

  HIRE_LIVE(s, ev) {
    s.staff[ev.role] = (s.staff[ev.role] || 0) + 1;
    s.hires = s.hires.filter((h) => h.id !== ev.id);
    log(s, `New ${D.ROLES[ev.role].name} starts work today.`, 'good');
  },

  MONTH_END(s, ev) {
    const m = ev.m;
    const d = dayOf(s.t);
    if (C(s).cutoff === 'checklist') cutoffChecklist(s, m);
    if (C(s).count === 'monthly') stockCount(s, 'Month-end count');
    if (C(s).monitoring === 'monthly') reminders(s, d, 4);
    // payroll, rent, running costs
    let pay = 0;
    for (const r of D.ROLE_IDS) pay += headcount(s, r) * D.ROLES[r].salary;
    expense(s, 'salaries', pay, 'Salaries');
    expense(s, 'rent', D.RENT, 'Rent and utilities');
    let run = 0;
    for (const st of D.STEPS) for (const c of st.controls) { const o = c.options && c.options.find((x) => x.v === s.controls[c.key]); if (o && o.monthly) run += o.monthly; }
    if (run) expense(s, 'running', run, 'Running cost of new systems');
    // unapproved write-offs when one clerk controls everything (from April)
    if (C(s).roles === 'asis' && m >= 1 && rand(s) < 0.35) {
      const open = s.invoices.filter((i) => !i.project && !i.writtenOff && i.amount - i.cn - i.truePaid > 3000);
      if (open.length) { const inv = open[ri(s, 0, open.length - 1)];
        schedule(s, s.t + 10, 'CREDIT_NOTE', { inv: inv.id, amount: ri(s, 1, 3) * 1000, reason: 'Goodwill (no approval)', hidden: true }); }
    }
    // Sky Home default risk
    const d2 = s.dealers.D2;
    if (m >= 1 && d2.status === 'active' && oldestOverdueDays(s, 'D2', d) > 60 && rand(s) < 0.3) defaultDealer(s, 'D2');
    s.monthEnd[m] = snapshot(s, d, true);
  },

  MONTH_CLOSE(s, ev) {
    const m = ev.m;
    const rep = computeMonthReport(s, m);
    s.reports.push(rep);
    log(s, `Books for ${rep.monthName} are closed. Month-end report is ready.`, 'good', { report: m });
    if (rep.auditFail) {
      if (m === 0) {
        rep.auditWarning = true;
        log(s, `Auditors flag the March books: revenue errors are ${Math.round(rep.grossErrPct * 100)}% of correct revenue (limit 10%). March is your starting point, so this is a warning. From April each failed month is a strike.`, 'bad');
      } else {
        s.strikes++;
        rep.strike = s.strikes;
        log(s, `Auditors rejected the ${rep.monthName} books: revenue errors are ${Math.round(rep.grossErrPct * 100)}% of correct revenue (limit 10%). Strike ${s.strikes} of 2.`, 'bad');
      }
    }
    ask(s, 'month_close'); if (m === 0) ask(s, 'revenue_rule');
    s.newReport = m;
    if (s.mode === 'campaign') {
      if (s.strikes >= 2) s.over = { result: 'lose', reason: 'The auditors rejected the books twice. The CFO has lost confidence in the process.' };
      else if (m >= 3) s.over = { result: 'end', reason: 'The campaign (March to June) is complete.' };
    }
  },

  PROJECT_SIGN(s) {
    const P = D.PROJECT;
    s.project = { signed: dayOf(s.t), value: P.units * P.price, advance: 0, liability: 0, delivered: 0, revenue: 0, cost: 0, ar: 0, paid: 0, log: [] };
    s.project.log.push({ day: dayOf(s.t), text: `Contract signed: ${P.units} × ${P.product} at ${n0(P.price)} = ${n0(P.units * P.price)}. Nothing booked.` });
    log(s, `${P.name} signs a ${n0(P.units * P.price)} contract for ${P.units} × ${P.product}, delivered April to June. 20% advance due.`, 'order');
    ask(s, 'project_signed');
  },
  PROJECT_ADVANCE(s) {
    const P = D.PROJECT; const amt = P.units * P.price * P.advancePct;
    income(s, amt); s.project.advance = amt; s.project.liability = amt;
    s.project.log.push({ day: dayOf(s.t), text: `Advance ${n0(amt)} received: cash +${n0(amt)}, contract liability +${n0(amt)}. Revenue 0.` });
    log(s, `${P.name} paid a ${n0(amt)} advance. Cash is in the bank, but it is a liability until the units are delivered.`, 'cash');
    ask(s, 'project_advance');
  },
  PROJECT_DELIVERY(s, ev) {
    const P = D.PROJECT; const dl = P.deliveries[ev.i]; const pr = s.project; if (!pr) return;
    const value = dl.units * P.price, cost = dl.units * P.unitCost, adv = Math.min(pr.liability, value * P.advancePct);
    expense(s, 'project_purchase', cost, `${dl.units} × ${P.product} bought for ${P.name}`);
    pr.delivered += dl.units; pr.revenue += value; pr.cost += cost; pr.liability -= adv; pr.ar += value - adv;
    const inv = { id: 'PINV-' + s.seq.pinv++, project: true, dealer: 'HOTEL', day: dayOf(s.t), amount: value, advanceUsed: adv, due: dayOf(s.t) + P.payAfter, cn: 0, erpPaid: 0, truePaid: 0, writtenOff: 0 };
    s.invoices.push(inv);
    s.truck.push({ s: s.t, e: s.t + 300, order: 'HOTEL', dealer: 'HOTEL' });
    pr.log.push({ day: dayOf(s.t), text: `${dl.units} units delivered: revenue +${n0(value)}, cost +${n0(cost)}, advance used ${n0(adv)}, receivable +${n0(value - adv)} (${inv.id}).` });
    log(s, `${dl.units} × ${P.product} delivered to ${P.name}: revenue ${n0(value)}; ${n0(adv)} taken from the advance.`, 'good');
    schedule(s, tOf(dayOf(s.t) + P.payAfter, 11 * 60), 'PROJECT_PAY', { inv: inv.id, amount: value - adv });
    if (ev.i === 0) ask(s, 'project_delivery');
    if (ev.i === P.deliveries.length - 1) ask(s, 'project_end');
  },
  PROJECT_PAY(s, ev) {
    const inv = s.invoices.find((i) => i.id === ev.inv);
    income(s, ev.amount); inv.truePaid = inv.erpPaid = ev.amount; s.project.ar -= ev.amount; s.project.paid += ev.amount;
    s.project.log.push({ day: dayOf(s.t), text: `${D.PROJECT.name} paid ${n0(ev.amount)} for ${inv.id}: cash +${n0(ev.amount)}, receivable −${n0(ev.amount)}.` });
    log(s, `${D.PROJECT.name} paid ${n0(ev.amount)} (${inv.id}).`, 'cash');
  },
};

// ---------- process pieces ----------
function hold(s, o, fmDelayMin) {
  o.stage = 'held'; o.heldDay = dayOf(s.t); o.heldT = s.t;
  olog(s, o, `Order on credit hold. Waiting for the Finance Manager.`);
  log(s, `${o.id} on credit hold (${D.DEALERS[o.dealer].short}).`, 'warn', { order: o.id });
  const t = book(s, 'FM', 0.5, s.t + fmDelayMin, 'fm', 'Credit decision ' + o.id);
  schedule(s, t, 'FM_REVIEW', { order: o.id });
  if (o.dealer === 'D2' && o.credit.pol.overdue > 0 && monthOf(dayOf(s.t)) === 0) ask(s, 'promise');
}

function release(s, o, by, why) {
  if (o.stage === 'cancelled' || o.released) return;
  o.released = true; o.releasedBy = by; o.releaseDay = dayOf(s.t); o.stage = 'warehouse';
  const pol = creditView(s, o, 'true');
  o.flags.creditBreach = o.policyHold && !o.override && (by !== 'ERP' || pol.fail);
  if (by === 'ERP' && !pol.fail) o.flags.creditBreach = false;
  olog(s, o, `Released (${why}).${o.flags.creditBreach ? ' BREACH of P1: policy says hold and the Finance Manager did not approve.' : ''}`);
  if (o.flags.creditBreach) log(s, `${o.id} released against credit policy P1 (${why}).`, 'bad', { order: o.id });
  // pick and ship
  let shipDay = dayOf(s.t) + 1;
  if (o.requestedDay != null) shipDay = Math.max(shipDay, o.requestedDay);
  const picked = book(s, 'WH', 1.5, tOf(shipDay, DAY_START), 'warehouse', 'Pick ' + o.id);
  o.wh = s.lastStaff;
  const dTruck = book(s, 'DR', 3, Math.max(picked, tOf(dayOf(picked), 10 * 60)), 'truck', 'Deliver ' + o.id);
  o.dr = s.lastStaff;
  const shipT = Math.max(picked, dTruck - 180);
  o.waitH += Math.max(0, (dayOf(shipT) - shipDay)) * 10;
  schedule(s, shipT, 'SHIP', { order: o.id, qty: o.qty });
}

function createInvoice(s, dn, qtySource, forceDay) {
  const o = orderById(s, dn.order);
  let qty;
  if (qtySource === 'order') {
    const already = s.invoices.filter((i) => i.order === o.id).reduce((a, i) => a + i.qty, 0);
    qty = Math.max(0, o.qty - already);
    if (qty === 0) { dn.inv = 'none'; return; }
  } else qty = dn.qty;
  const day = forceDay != null ? forceDay : dayOf(s.t);
  const inv = { id: 'INV-' + s.seq.inv++, dealer: dn.dealer, order: o.id, dn: dn.dn, day, qty, price: o.price, amount: qty * o.price,
    due: day + D.DEALERS[dn.dealer].terms, cn: 0, erpPaid: 0, truePaid: 0, writtenOff: 0, payToken: 0 };
  s.invoices.push(inv);
  dn.inv = inv.id; dn.missed = false;
  if (C(s).invoicing !== 'auto') book(s, 'BC', C(s).invoicing === 'daily' ? 0.2 : 0.5, s.t, 'billing', 'Invoice ' + inv.id);
  const correct = dn.qty * o.price;
  const late = monthOf(day) !== dn.month;
  olog(s, o, `${inv.id} raised, dated ${fmtDay(day)}: ${qty} × ${n0(o.price)} = ${n0(inv.amount)}. Due ${fmtDay(inv.due)}.`, [
    'The ERP books revenue on the invoice date: +' + n0(inv.amount) + ' in ' + fmtDay(day).split('-')[1] + '.',
    inv.amount !== correct ? `But only ${dn.qty} were delivered: real revenue is ${n0(correct)}. Over-billed by ${n0(inv.amount - correct)}.` : 'Amount matches what was delivered.',
    late ? `Wrong month: delivered in ${fmtDay(dn.day).split('-')[1]}, invoiced in ${fmtDay(day).split('-')[1]} (cut-off error).` : 'Same month as delivery.']);
  ask(s, 'first_invoice');
  if (inv.amount > correct) schedule(s, tOf(day + 3, 11 * 60), 'DISPUTE', { inv: inv.id, correct });
  planPayment(s, inv, o, correct);
}

function planPayment(s, inv, o, correct) {
  const dd = D.DEALERS[inv.dealer];
  inv.payToken = (inv.payToken || 0) + 1;
  if (o.scripted && o.script.pay && o.dns[0] === inv.dn && !inv.scriptPaid) {
    inv.scriptPaid = true;
    const p = o.script.pay;
    schedule(s, tOf(p.day, 10 * 60), 'RECEIPT', { dealer: inv.dealer, amount: p.amount || inv.amount, ref: p.ref ? inv.id : null, intended: inv.id, scripted: true, inv: p.amount ? null : inv.id, token: p.amount ? undefined : inv.payToken });
    return;
  }
  let day = inv.day + ri(s, dd.payMin, dd.payMax);
  if (inv.day <= 30) day = Math.max(day, 31 + ri(s, 0, 6));
  const noRefP = C(s).askRefs === 'on' ? dd.noRef * 0.15 : dd.noRef;
  const ref = rand(s) < noRefP ? null : inv.id;
  const amount = Math.min(correct, inv.amount);
  inv.payDay = day;
  if (dd.risky && rand(s) < 0.4) {
    const half = Math.round(amount / 2 / 100) * 100;
    schedule(s, tOf(day, 10 * 60), 'RECEIPT', { dealer: inv.dealer, amount: half, ref, intended: inv.id, part: true });
    schedule(s, tOf(day + ri(s, 15, 30), 10 * 60), 'RECEIPT', { dealer: inv.dealer, amount: amount - half, ref, intended: inv.id, inv: inv.id, token: inv.payToken });
  } else schedule(s, tOf(day, 10 * 60), 'RECEIPT', { dealer: inv.dealer, amount, ref, intended: inv.id, inv: inv.id, token: inv.payToken });
}

// Reminders make late payers pay sooner (they reschedule their payment).
function reminders(s, d, label) {
  for (const inv of s.invoices) {
    if (inv.project || inv.dealer === 'HOTEL' || inv.writtenOff) continue;
    const open = inv.amount - inv.cn - inv.truePaid;
    if (open <= 0 || d <= inv.due) continue;
    const dd = D.DEALERS[inv.dealer];
    if (s.dealers[inv.dealer].status !== 'active') continue;
    const p = dd.risky ? 0.4 : 0.85;
    if (rand(s) < p && (!inv.payDay || inv.payDay > d + 6) && inv.day > -1) {
      inv.payToken++; inv.payDay = d + ri(s, 2, 6);
      const ref = rand(s) < (C(s).askRefs === 'on' ? dd.noRef * 0.15 : dd.noRef) ? null : inv.id;
      schedule(s, tOf(inv.payDay, 11 * 60), 'RECEIPT', { dealer: inv.dealer, amount: open, ref, intended: inv.id, inv: inv.id, token: inv.payToken });
    } else if (inv.opening && inv.dealer === 'D2' && d >= 31 && rand(s) < p && !inv.reminded) {
      inv.reminded = true;
      schedule(s, tOf(d + ri(s, 3, 9), 11 * 60), 'RECEIPT', { dealer: 'D2', amount: open, ref: inv.id, intended: inv.id, inv: inv.id, token: inv.payToken });
    }
  }
}

function weekly(s, d) {
  // weekly change-log report
  if (C(s).mdReport === 'on') {
    for (const ch of s.mdChanges) {
      if (!ch.approved && !ch.reverted && !ch.rejected) {
        ch.reverted = d; s.dealers[ch.dealer].erpLimit = s.dealers[ch.dealer].approvedLimit;
        book(s, 'FM', 0.3, s.t, 'fm', 'Change report');
        log(s, `Change-log report: unapproved limit change for ${D.DEALERS[ch.dealer].short} reversed (back to ${n0(s.dealers[ch.dealer].approvedLimit)}).`, 'good');
      }
    }
  }
  if (C(s).dni === 'on') {
    for (const dn of s.deliveries) {
      if (!dn.inv && dn.missed && !dn.lost && d - dn.day >= 2) {
        dn.missed = false;
        createInvoice(s, dn, C(s).invoicing === 'asis' ? 'order' : 'dn');
        log(s, `"Delivered not invoiced" report found ${dn.dn}: invoice raised.`, 'good');
      }
    }
  }
  if (C(s).cashapp === 'asis' && d >= 31) reviewSuspense(s, 0.3);
  if (C(s).count === 'weekly') stockCount(s, 'Weekly cycle count');
  if (C(s).monitoring !== 'monthly') { reminders(s, d, 2); book(s, 'FM', 2, s.t, 'fm', 'Weekly ageing review'); }
}

function reviewSuspense(s, p) {
  for (const r of s.receipts) {
    if (r.suspense && !r.applied && rand(s) < p) {
      r.applied = true; r.appliedDay = dayOf(s.t); r.suspense = false;
      allocate(s, r.dealer, r.amount, null, 'erpPaid');
      book(s, 'CAO', 0.3, s.t, 'cash', 'Clear suspense ' + r.id);
      log(s, `${r.id} (${n0(r.amount)}) matched to ${D.DEALERS[r.dealer].short} and cleared from suspense.`, 'good');
    }
  }
}

function stockCount(s, label) {
  const parts = [];
  for (const p of D.PRODUCT_IDS) {
    const st = s.stock[p];
    const diff = st.real - st.sys;
    if (diff) parts.push(`${p} ${diff > 0 ? '+' : ''}${diff}`);
    st.sys = st.real;
    st.lastCount = { day: dayOf(s.t), real: st.real };
    checkReorder(s, p);
  }
  book(s, 'WH', 3, s.t, 'warehouse', label);
  log(s, `${label}: ${parts.length ? 'ERP corrected (' + parts.join(', ') + ')' : 'ERP matched the shelves'}.`, parts.length ? 'warn' : 'good');
}

function checkReorder(s, p) {
  const st = s.stock[p];
  const r = D.REORDER[p];
  if (st.sys + s.onOrder[p] < r.rop) {
    s.onOrder[p] += r.qty;
    s.purchases.push({ day: dayOf(s.t), product: p, qty: r.qty, arrive: dayOf(s.t) + D.REORDER.lead });
    schedule(s, tOf(dayOf(s.t) + D.REORDER.lead, 8 * 60 + 30), 'STOCK_ARRIVE', { product: p, qty: r.qty });
    log(s, `ERP stock of ${p} is ${st.sys}: reorder of ${r.qty} placed (arrives in ${D.REORDER.lead} days).`, 'info');
  }
}

function mdChange(s, ev) {
  const dl = s.dealers[ev.dealer];
  const rec = { day: dayOf(s.t), dealer: ev.dealer, from: ev.from ?? dl.erpLimit, to: ev.to, by: 'Sales Executive', approved: false };
  if (C(s).md === 'asis') {
    dl.erpLimit = ev.to;
    log(s, `Change log: a Sales Executive changed ${D.DEALERS[ev.dealer].short}'s credit limit from ${n0(rec.from)} to ${n0(ev.to)}. Approved by: nobody.`, 'bad');
  } else {
    rec.rejected = true;
    book(s, 'FM', 0.3, s.t, 'fm', 'Limit request');
    log(s, `Sales asked to raise ${D.DEALERS[ev.dealer].short}'s limit to ${n0(ev.to)}. The Finance Manager rejected it (no reason given).`, 'good');
  }
  s.mdChanges.push(rec);
}

function cutoffChecklist(s, m) {
  let n = 0, c = 0;
  for (const dn of s.deliveries) {
    if (dn.month !== m || dn.inv || dn.lost) continue;
    dn.missed = false; createInvoice(s, dn, 'dn'); n++;
  }
  for (const inv of s.invoices) {
    if (inv.project || monthOf(inv.day) !== m || !inv.dn) continue;
    const dn = s.deliveries.find((x) => x.dn === inv.dn);
    const extra = inv.amount - inv.cn - dn.qty * inv.price;
    if (extra > 0) { inv.dispute = true; schedule(s, s.t + 5, 'CREDIT_NOTE', { inv: inv.id, amount: extra, reason: 'Cut-off check: invoiced not delivered', checklist: true }); c++; }
  }
  book(s, 'FM', 3, s.t - 120, 'fm', 'Cut-off checklist');
  log(s, `Cut-off checklist: ${n} delivered-not-invoiced item${n === 1 ? '' : 's'} invoiced in the right month; ${c} over-billed invoice${c === 1 ? '' : 's'} credited.`, 'good');
}

function defaultDealer(s, id) {
  const dl = s.dealers[id];
  dl.status = 'defaulted';
  let lost = 0;
  for (const inv of s.invoices) {
    if (inv.dealer !== id) continue;
    const open = inv.amount - inv.cn - inv.writtenOff - inv.truePaid;
    if (open > 0) { inv.writtenOff += open; lost += open; }
  }
  // deliveries never invoiced are lost too
  for (const dn of s.deliveries) if (dn.dealer === id && !dn.inv) { dn.lost = true; lost += dn.value; }
  for (const o of s.orders) if (o.dealer === id && ['held', 'pricing', 'credit', 'inbox'].includes(o.stage)) o.stage = 'cancelled';
  s.expenses.push({ day: dayOf(s.t), type: 'baddebt', amount: lost, label: `${D.DEALERS[id].name} went out of business` });
  log(s, `${D.DEALERS[id].name} has gone out of business. ${n0(lost)} it owed is written off as bad debt.`, 'bad');
  ask(s, 'bad_debt');
}

function oldestOpen(s, dealer) {
  const list = s.invoices.filter((i) => i.dealer === dealer && i.amount - i.cn - i.truePaid - i.writtenOff > 0).sort((a, b) => a.day - b.day);
  return list[0] ? list[0].id : null;
}

// ---------- snapshots for charts and balance sheet ----------
export function snapshot(s, d, full) {
  const inv = s.invoices.filter((i) => !i.project);
  const opening = D.OPENING_INVOICES.reduce((a, i) => a + i.amount, 0);
  const invoiced = inv.filter((i) => !i.opening && i.day <= d).reduce((a, i) => a + i.amount, 0);
  const cn = s.creditNotes.filter((c) => c.day <= d).reduce((a, c) => a + c.amount, 0);
  const received = s.receipts.filter((r) => r.day <= d).reduce((a, r) => a + r.amount, 0);
  const wo = inv.reduce((a, i) => a + i.writtenOff, 0);
  const delivered = s.deliveries.filter((x) => x.day <= d).reduce((a, x) => a + x.value, 0);
  const lostDn = s.deliveries.filter((x) => x.lost).reduce((a, x) => a + x.value, 0);
  const erpAR = opening + invoiced - cn - received - wo;
  const trueAR = opening + delivered - received - (wo - 0) - lostDn - s.expenses.filter((e) => e.type === 'writeoff_hidden').reduce((a, e) => a + e.amount, 0);
  let overdue = 0;
  for (const id of D.DEALER_IDS) overdue += dealerOverdue(s, id, 'true', d);
  const suspense = s.receipts.filter((r) => r.suspense && !r.applied).reduce((a, r) => a + r.amount, 0);
  const m = monthOf(d), f = monthFirst(m);
  const bookedMTD = inv.filter((i) => !i.opening && i.day >= f && i.day <= d).reduce((a, i) => a + i.amount, 0) - s.creditNotes.filter((c) => c.day >= f && c.day <= d).reduce((a, c) => a + c.amount, 0);
  const trueMTD = s.deliveries.filter((x) => x.day >= f && x.day <= d).reduce((a, x) => a + x.value, 0);
  const snap = { d, cash: s.cash, erpAR, trueAR, overdue, suspense, bookedMTD, trueMTD,
    held: s.orders.filter((o) => o.stage === 'held').length,
    exceptions: s.orders.filter((o) => o.day >= f && (o.flags.creditBreach || o.flags.discountBreach || o.flags.intakeError || o.flags.shortUntracked)).length };
  if (full) {
    snap.dealers = Object.fromEntries(D.DEALER_IDS.map((id) => [id, { erp: dealerBalance(s, id, 'erp'), tru: dealerBalance(s, id, 'true'), overdue: dealerOverdue(s, id, 'true', d), oldest: oldestOverdueDays(s, id, d) }]));
    snap.stock = JSON.parse(JSON.stringify(s.stock));
  }
  return snap;
}

// ---------- player actions ----------
export function findOption(key, v) {
  for (const st of D.STEPS) for (const c of st.controls) if (c.key === key && c.options) return c.options.find((o) => o.v === v);
  return null;
}
export function findControl(key) {
  for (const st of D.STEPS) for (const c of st.controls) if (c.key === key) return c;
  return null;
}
export function canChoose(s, key, v) {
  const o = findOption(key, v);
  if (!o || !o.needs) return { ok: true };
  if (o.needs.hire && headcount(s, o.needs.hire) < 1) return { ok: false, why: `Needs a ${D.ROLES[o.needs.hire].name} (hire one in the Staff tab).` };
  for (const k of Object.keys(o.needs)) {
    if (k === 'hire') continue;
    if (!o.needs[k].includes(s.controls[k])) {
      const need = findOption(k, o.needs[k][0]);
      return { ok: false, why: `Needs "${need ? need.label : o.needs[k][0]}" to be live first.` };
    }
  }
  return { ok: true };
}
export function setControl(s, key, value) {
  const c = findControl(key);
  if (!c) return { ok: false, why: 'Unknown control' };
  if (c.free) { s.controls[key] = value; s.changeLog.push({ day: dayOf(s.t), key, value, live: true }); return { ok: true, msg: 'Changed now.' }; }
  if (s.controls[key] === value && !s.pending[key]) return { ok: false, why: 'Already live.' };
  const chk = canChoose(s, key, value);
  if (!chk.ok) return chk;
  const o = findOption(key, value);
  s.ctlToken[key] = (s.ctlToken[key] || 0) + 1;
  if (o.cost) expense(s, 'change', o.cost, `Set-up: ${o.label}`);
  s.changeLog.push({ day: dayOf(s.t), key, value, cost: o.cost });
  if (!o.days || s.controls[key] === value) {
    s.controls[key] = value; delete s.pending[key];
    log(s, `Changed: ${c.label}: ${o.label}.`, 'info');
    return { ok: true, msg: 'Live now.' };
  }
  const t = tOf(dayOf(s.t) + o.days, DAY_START);
  s.pending[key] = { value, t };
  schedule(s, t, 'CONTROL_LIVE', { key, value, token: s.ctlToken[key] });
  log(s, `Ordered: ${o.label} (cost ${n0(o.cost)}). Live on ${fmtDay(dayOf(t))}.`, 'info');
  return { ok: true, msg: `Set-up started. Live on ${fmtDay(dayOf(t))}.` };
}
export function hire(s, role) {
  const cur = headcount(s, role) + s.hires.filter((h) => h.role === role).length;
  if (cur >= D.MAX_HEADCOUNT[role]) return { ok: false, why: 'Maximum headcount reached.' };
  const id = 'H' + s.seq.p++;
  const t = tOf(dayOf(s.t) + D.HIRE_LEAD_DAYS, DAY_START);
  s.hires.push({ id, role, t });
  schedule(s, t, 'HIRE_LIVE', { role, id });
  expense(s, 'hiring', 2000, `Recruitment: ${D.ROLES[role].name}`);
  log(s, `Recruiting a ${D.ROLES[role].name} (fee 2,000). Starts ${fmtDay(dayOf(t))}; salary ${n0(D.ROLES[role].salary)}/month.`, 'info');
  return { ok: true, msg: `Starts on ${fmtDay(dayOf(t))}.` };
}
export function letGo(s, role) {
  if (headcount(s, role) <= 0) return { ok: false, why: 'Nobody in this role.' };
  if (role === 'CAO' && s.controls.roles === 'split' && headcount(s, 'CAO') === 1) return { ok: false, why: 'Segregated duties need this person. Change "Roles and duties" first.' };
  if (role === 'CR' && s.controls.md === 'makerchecker' && headcount(s, 'CR') === 1) return { ok: false, why: 'Maker-checker needs this person.' };
  if (['GM', 'FM', 'SM'].includes(role) || (D.ROLES[role].base > 0 && headcount(s, role) <= 1)) return { ok: false, why: 'This role cannot be left empty.' };
  s.staff[role]--;
  log(s, `One ${D.ROLES[role].name} left the company.`, 'warn');
  return { ok: true };
}
// The Finance Manager formally approves a new credit limit (allowed under every master-data setting).
export function setApprovedLimit(s, dealer, value) {
  const dl = s.dealers[dealer];
  value = Math.max(0, Math.round(value / 1000) * 1000);
  if (value === dl.approvedLimit) return { ok: false, why: 'No change.' };
  s.mdChanges.push({ day: dayOf(s.t), dealer, from: dl.approvedLimit, to: value, by: 'Finance Manager', approved: true });
  dl.approvedLimit = value; dl.erpLimit = value;
  book(s, 'FM', 0.3, s.t, 'fm', 'Limit review ' + dealer);
  log(s, `Finance Manager approved a new credit limit for ${D.DEALERS[dealer].short}: ${n0(value)}.`, 'good');
  return { ok: true, msg: 'Approved and live.' };
}
// A simple guide: average monthly sales × payment days / 30 × 1.2
export function suggestedLimit(s, dealer) {
  const d = dayOf(s.t);
  const recent = s.deliveries.filter((x) => x.dealer === dealer && x.day > d - 60);
  const monthly = recent.reduce((a, x) => a + x.value, 0) / 2;
  const dd = D.DEALERS[dealer];
  const days = (dd.payMin + dd.payMax) / 2;
  return Math.max(dd.limit, Math.round(monthly * days / 30 * 1.2 / 5000) * 5000);
}
export function answerQuestion(s, id, choice) {
  const q = questionById(s, id);
  if (!q) return false;
  s.answers.push({ id, choice, correct: choice === q.answer, day: dayOf(s.t) });
  return choice === q.answer;
}

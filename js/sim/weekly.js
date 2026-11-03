// Weekly review: at the end of every 7th day the game asks up to 5 questions about that week.
// Concept questions triggered during the week come first; the rest are built from the week's real numbers.
// Picks here never touch the business random numbers (s.rng).
import * as D from '../data.js?v=6';
import { fmtDay, monthOf } from './time.js?v=6';

const n0 = (x) => Math.round(x).toLocaleString('en-US');
const MAX = 5;
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
const pctLabel = (d) => Math.round(d * 100) + '%';

// Deterministic "shuffle" so the right answer is not always in the same place.
function arrange(correct, wrong, seed) {
  const seen = new Set([correct]);
  const opts = [correct];
  for (const w of wrong) if (!seen.has(w)) { seen.add(w); opts.push(w); }
  const fillers = ['None of these', 'It depends on the month-end close', 'Only the auditors can tell'];
  for (const f of fillers) { if (opts.length >= 4) break; if (!seen.has(f)) { seen.add(f); opts.push(f); } }
  const list = opts.slice(0, 4);
  const shift = seed % list.length;
  const rotated = list.slice(shift).concat(list.slice(0, shift));
  return { options: rotated, answer: rotated.indexOf(correct) };
}

// Each builder returns a question object, or null when it does not apply this week.
const BUILDERS = {
  promise(w) {
    if (!w.orders.length) return null;
    const v = sum(w.orders, (o) => o.value);
    const del = sum(w.dns, (x) => x.value);
    const a = arrange('0: an order is only a promise', [n0(v) + ': the value of the orders', n0(Math.round(v / 2)) + ': half, as a deposit', n0(del) + ': what was delivered'], w.seed);
    return { title: 'Orders received this week', concept: 'promise',
      q: `This week dealers sent ${w.orders.length} order${w.orders.length > 1 ? 's' : ''} worth ${n0(v)}. Just for being ordered, how much of that is in the accounts as revenue or money owed to Zenith?`,
      ...a, explain: `Nothing. An order is a promise from both sides. It becomes revenue and a receivable only when the goods are <b>delivered</b>. This week the deliveries were worth ${n0(del)}.` };
  },
  earned(w) {
    if (!w.dns.length) return null;
    const del = sum(w.dns, (x) => x.value), inv = sum(w.invs, (i) => i.amount), cash = sum(w.recs, (r) => r.amount);
    const ordered = sum(w.orders, (o) => o.value);
    const alt = [inv, cash, ordered, del - (w.dns[0] ? w.dns[0].value : 0), inv + cash, Math.round(del * 0.8 / 100) * 100, del + 15000];
    const a = arrange(n0(del), alt.filter((x) => x >= 0 && x !== del).map(n0), w.seed + 1);
    return { title: 'Revenue earned this week', concept: 'delivery',
      q: `This week: goods <b>delivered</b> ${n0(del)}, invoices <b>dated</b> ${n0(inv)}, cash <b>received</b> ${n0(cash)}, new orders ${n0(ordered)}. How much revenue did Zenith really earn this week?`,
      ...a, explain: `Revenue is earned on delivery: <b>${n0(del)}</b>. Invoices (${n0(inv)}) are documents and can be late, missing or wrong. Cash (${n0(cash)}) pays for earlier sales. Orders (${n0(ordered)}) are promises.` };
  },
  receipt(w) {
    const r = w.recs.find((x) => !x.ref) || w.recs[w.recs.length - 1];
    if (!r) return null;
    const who = D.DEALERS[r.dealer].short;
    const right = r.ref ? `Cash +${n0(r.amount)}; ${who}'s receivable −${n0(r.amount)} once applied; revenue unchanged`
      : `Cash +${n0(r.amount)}; but the ERP still shows ${who} owing it until someone matches it`;
    const a = arrange(right, [`Revenue +${n0(r.amount)}`, 'Nothing until the month-end close', `Cash +${n0(r.amount)} and revenue +${n0(r.amount)}`], w.seed + 2);
    return { title: `${r.id}: money arrives`, concept: r.ref ? 'cash' : 'cashapp',
      q: `${r.id}: ${n0(r.amount)} reached Zenith's bank from ${who} ${r.ref ? `quoting ${r.ref}` : '<b>with no invoice reference</b>'}. What changes?`,
      ...a, explain: r.ref ? 'Cash counts when it reaches the bank. It pays for a sale already counted as revenue, so revenue does not change: the receivable turns into cash.'
        : 'Cash counts as soon as it is in the bank. But with no reference it goes to the suspense list, so the dealer looks like it still owes the money. That can trigger wrong credit holds and wrong reminder calls.' };
  },
  credit(w) {
    const o = w.checked[(w.seed) % Math.max(1, w.checked.length)];
    if (!o) return null;
    const p = o.credit.pol;
    const over = p.exposure > p.limit, od = p.overdue > 0;
    const right = over && od ? 'Hold: over the limit and an invoice is overdue' : over ? `Hold: exposure ${n0(p.exposure)} is over the limit` : od ? `Hold: ${n0(p.overdue)} is overdue` : 'Release: within the limit and nothing overdue';
    const wrong = ['Release: within the limit and nothing overdue', `Hold: exposure ${n0(p.exposure)} is over the limit`, `Hold: ${n0(Math.max(p.overdue, 1000))} is overdue`, 'Hold: over the limit and an invoice is overdue'];
    const a = arrange(right, wrong.filter((x) => x !== right), w.seed + 3);
    const what = o.flags.creditBreach ? `In the game it was released by ${o.releasedBy === 'SE' ? 'a Sales Executive' : o.releasedBy} without the Finance Manager: a P1 breach.` : o.override ? 'The Finance Manager approved an override with a reason and expiry.' : o.stage === 'held' ? 'It is on credit hold.' : 'It was released correctly.';
    return { title: `Credit check: ${o.id}`, concept: 'exposure',
      q: `${o.id} from ${D.DEALERS[o.dealer].short}: balance before the order ${n0(p.bal)} + order ${n0(o.value)}. Approved limit ${n0(p.limit)}. Overdue ${n0(p.overdue)}. What does policy P1 say?`,
      ...a, explain: `Exposure = ${n0(p.bal)} + ${n0(o.value)} = <b>${n0(p.exposure)}</b> against ${n0(p.limit)}${od ? `, and ${n0(p.overdue)} is overdue` : ''}. ${what}` };
  },
  billing(w) {
    const bad = w.dns.map((dn) => ({ dn, inv: w.s.invoices.find((i) => i.dn === dn.dn) })).find((x) => x.inv && x.inv.qty !== x.dn.qty);
    if (!bad) return null;
    const { dn, inv } = bad;
    const diff = (inv.qty - dn.qty) * dn.price;
    const a = arrange(`${n0(diff)} over-billed`, [`${n0(inv.amount)} over-billed`, 'Nothing: the invoice is right', `${n0(dn.value)} over-billed`], w.seed + 4);
    return { title: `${dn.dn}: invoice vs delivery`, concept: 'pod',
      q: `${dn.dn} shows ${dn.qty} units delivered at ${n0(dn.price)}. ${inv.id} bills ${inv.qty} units (${n0(inv.amount)}). What is wrong?`,
      ...a, explain: `Should invoice = delivered ${dn.qty} × ${n0(dn.price)} = ${n0(dn.value)}. The invoice is ${n0(diff)} too high, so revenue and receivables are overstated and the dealer will dispute it. Invoicing from the signed delivery note (step 7) prevents this.` };
  },
  suspense(w) {
    const sus = w.s.receipts.filter((r) => r.suspense && !r.applied);
    if (!sus.length) return null;
    const v = sum(sus, (r) => r.amount), cash = sum(w.recs, (r) => r.amount);
    const a = arrange(n0(v), [n0(cash), '0', n0(v * 2), n0(v + 5000)].filter((x) => x !== n0(v)), w.seed + 5);
    return { title: 'Cash on the suspense list', concept: 'cashapp',
      q: `How much cash is in Zenith's bank right now but still sitting on the suspense list (not matched to any invoice)?`,
      ...a, explain: `${sus.map((r) => `${r.id} ${n0(r.amount)} from ${D.DEALERS[r.dealer].short}`).join(', ')}: <b>${n0(v)}</b>. It is counted as cash, but the dealers' balances still look too high. A daily suspense review (step 9) clears it.` };
  },
  discount(w) {
    const o = w.orders.find((x) => x.disc > 0.05) || w.orders.find((x) => x.disc > 0);
    if (!o) return null;
    const req = o.disc <= 0.05 ? 'A Sales Executive' : o.disc <= 0.10 ? 'The Sales Manager' : 'The General Manager and the Finance Manager together';
    const a = arrange(req, ['A Sales Executive', 'The Sales Manager', 'The General Manager and the Finance Manager together', 'Nobody: discounts are free'].filter((x) => x !== req), w.seed + 6);
    const names = { SE: 'a Sales Executive', SM: 'the Sales Manager', GMFM: 'the GM and FM' };
    return { title: `Discount on ${o.id}`, concept: 'doa',
      q: `${o.id} has a ${pctLabel(o.disc)} discount off the list price. Under policy P2, who must approve it?`,
      ...a, explain: `P2: up to 5% Sales Executive; above 5% to 10% Sales Manager; above 10% GM + FM. ${o.approver ? `In the game it was approved by ${names[o.approver] || 'nobody'}${o.flags.discountBreach ? ': a breach' : ': correct'}.` : ''}` };
  },
  overdue(w) {
    const d = w.end;
    let best = null;
    for (const id of D.DEALER_IDS) {
      const od = w.s.invoices.filter((i) => i.dealer === id && !i.project && d > i.due).reduce((a, i) => a + Math.max(0, i.amount - i.cn - i.truePaid - i.writtenOff), 0);
      if (od > 0 && (!best || od > best.od)) best = { id, od };
    }
    if (!best) return null;
    const who = D.DEALERS[best.id].short;
    const a = arrange('Hold it: any overdue invoice means hold (only the FM can override)', ['Release it: the order is within the limit', 'Release it if the dealer promises to pay', 'Release half the order'], w.seed + 7);
    return { title: `${who} is overdue`, concept: 'overdue',
      q: `${who} has ${n0(best.od)} overdue. It sends a new order that would stay within its credit limit. What does P1 say?`,
      ...a, explain: 'P1 has two tests: exposure within the limit <b>and</b> nothing overdue. Failing either means hold. A promise to pay changes nothing until the cash is in the bank.' };
  },
};
const ORDER = ['earned', 'credit', 'receipt', 'promise', 'billing', 'suspense', 'discount', 'overdue'];

export function buildWeeklyReview(s, endDay) {
  const start = endDay - 6;
  const inW = (d) => d >= start && d <= endDay;
  const week = Math.floor(endDay / 7);
  const w = {
    s, end: endDay, seed: week * 7 + 3,
    orders: s.orders.filter((o) => inW(o.day)),
    dns: s.deliveries.filter((x) => inW(x.day)),
    invs: s.invoices.filter((i) => !i.opening && !i.project && inW(i.day)),
    recs: s.receipts.filter((r) => inW(r.day)),
  };
  w.checked = w.orders.filter((o) => o.credit);
  // carry over concept questions not yet shown
  s.qPending = s.qPending || [];
  const carry = s.weekReview ? s.weekReview.ids.slice(s.weekReview.idx) : [];
  const ids = s.qPending.splice(0, 3);
  s.dynQ = s.dynQ || {};
  for (let k = 0; k < ORDER.length && ids.length < MAX; k++) {
    const key = ORDER[(k + week) % ORDER.length];
    const q = BUILDERS[key](w);
    if (!q) continue;
    const id = `w${week}-${key}`;
    s.dynQ[id] = { ...q, weekly: true, day: endDay };
    ids.push(id);
  }
  while (ids.length < MAX && s.qPending.length) ids.push(s.qPending.shift());
  const summary = {
    orders: w.orders.length, ordersValue: sum(w.orders, (o) => o.value),
    delivered: sum(w.dns, (x) => x.value), deliveries: w.dns.length,
    invoiced: sum(w.invs, (i) => i.amount), cash: sum(w.recs, (r) => r.amount),
    held: s.orders.filter((o) => o.stage === 'held').length,
    breaches: w.orders.filter((o) => o.flags.creditBreach || o.flags.discountBreach).length,
    cancelled: w.orders.filter((o) => o.stage === 'cancelled').length,
  };
  // unanswered questions from earlier weeks stay in the queue (at most 10 waiting)
  let all = carry.concat(ids);
  if (all.length > 10) all = all.slice(all.length - 10);
  s.weekReview = all.length ? { start, end: endDay, label: `${fmtDay(start)} to ${fmtDay(endDay)}`, month: monthOf(endDay), ids: all, idx: 0, fresh: ids.length, summary } : null;
}

export const questionById = (s, id) => D.QUESTIONS[id] || (s.dynQ && s.dynQ[id]) || null;

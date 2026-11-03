// Month-end report: KPIs, the two sets of books, what went wrong, score.
import * as D from '../data.js';
import { monthOf, monthFirst, monthLast, monthName, fmtDay } from './time.js';

const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const n0 = (x) => Math.round(x).toLocaleString('en-US');
const NON_PL = new Set(['purchase', 'project_purchase']);

export function kpiProgress(k, val) {
  if (val == null || Number.isNaN(val)) return null;
  if (k.base === k.target) return k.dir === 'up' ? (val >= k.target ? 1 : Math.max(0, val / k.target)) : (val <= k.target ? 1 : 0);
  const p = k.dir === 'down' ? (k.base - val) / (k.base - k.target) : (val - k.base) / (k.target - k.base);
  return Math.max(0, Math.min(1, p));
}
export const stars = (p) => (p == null ? 0 : p >= 0.95 ? 3 : p >= 0.6 ? 2 : p >= 0.25 ? 1 : 0);

export function dnStatus(s, dn, m) {
  const inv = dn.inv && dn.inv !== 'none' ? s.invoices.find((i) => i.id === dn.inv) : null;
  if (!inv) return { ok: false, issue: dn.inv === 'none' ? 'billed in advance on an earlier invoice' : 'not invoiced', inv: null };
  if (inv.qty !== dn.qty) return { ok: false, issue: `billed ${inv.qty}, delivered ${dn.qty}`, inv, qty: true };
  if (monthOf(inv.day) !== dn.month) return { ok: false, issue: `invoiced ${fmtDay(inv.day)} (wrong month)`, inv, cutoff: true };
  return { ok: true, inv };
}

export function computeMonthReport(s, m, snapArg) {
  const f = monthFirst(m), l = monthLast(m);
  const inM = (d) => d >= f && d <= l;
  const orders = s.orders.filter((o) => inM(o.day));
  const released = s.orders.filter((o) => o.released && inM(o.releaseDay));
  const breaches = released.filter((o) => o.flags.creditBreach);
  const overrides = s.overrides.filter((x) => inM(x.day));
  const discounted = orders.filter((o) => o.disc > 0 && o.approver);
  const discBreach = discounted.filter((o) => o.flags.discountBreach);
  const mdUnauth = s.mdChanges.filter((c) => inM(c.day) && !c.rejected);
  const dns = s.deliveries.filter((x) => x.month === m);
  const dnInfo = dns.map((dn) => ({ dn, st: dnStatus(s, dn, m) }));
  const rightFirst = dns.length ? dnInfo.filter((x) => x.st.ok).length / dns.length : null;
  const dniList = dnInfo.filter((x) => !x.st.inv && x.dn.inv !== 'none');
  const dni = sum(dniList, (x) => x.dn.value);

  // revenue: what the ERP booked (by invoice date) vs what was earned (by delivery)
  const invM = s.invoices.filter((i) => !i.opening && !i.project && inM(i.day));
  const cnM = s.creditNotes.filter((c) => inM(c.day));
  const booked = sum(invM, (i) => i.amount) - sum(cnM, (c) => c.amount);
  const correct = sum(dns, (x) => x.value);
  // gross error, DN by DN
  const bookedFor = new Map();
  for (const i of invM) if (i.dn) bookedFor.set(i.dn, (bookedFor.get(i.dn) || 0) + i.amount);
  for (const c of cnM) { const i = s.invoices.find((x) => x.id === c.inv); if (i && i.dn) bookedFor.set(i.dn, (bookedFor.get(i.dn) || 0) - c.amount); }
  let gross = 0;
  const recon = [];
  const allDn = new Set([...dns.map((x) => x.dn), ...bookedFor.keys()]);
  for (const id of allDn) {
    const dn = s.deliveries.find((x) => x.dn === id);
    const tr = dn && dn.month === m ? dn.value : 0;
    const bk = bookedFor.get(id) || 0;
    if (tr !== bk) { gross += Math.abs(tr - bk); recon.push({ dn: id, order: dn ? dn.order : '', earned: tr, booked: bk, diff: tr - bk }); }
  }
  for (const c of cnM) { const i = s.invoices.find((x) => x.id === c.inv); if (!i || !i.dn) { gross += c.amount; recon.push({ dn: c.id, order: c.inv, earned: 0, booked: -c.amount, diff: c.amount }); } }
  const grossErrPct = correct ? gross / correct : 0;

  // cash application
  const recM = s.receipts.filter((r) => inM(r.day));
  const unappliedList = recM.filter((r) => !r.applied || r.appliedDay > l);
  const unapplied = recM.length ? sum(unappliedList, (r) => r.amount) / sum(recM, (r) => r.amount) : 0;

  const snap = snapArg || s.monthEnd[m] || { erpAR: 0, overdue: 0, trueAR: 0, cash: s.cash };
  const overduePct = snap.erpAR > 0 ? snap.overdue / snap.erpAR : 0;
  const stages = D.stageTable(s.controls);
  const waitDays = released.length ? sum(released, (o) => o.waitH) / released.length / 10 : 0;
  const holdDays = released.length ? sum(released.filter((o) => o.heldDay != null), (o) => o.releaseDay - o.heldDay) / released.length : 0;
  const cycle = sum(stages, (x) => x.days) + waitDays;
  const touches = sum(stages, (x) => x.touches);

  // exceptions per order
  const grid = orders.map((o) => {
    const myDn = dnInfo.filter((x) => x.dn.order === o.id).concat(s.deliveries.filter((x) => x.order === o.id && x.month !== m).map((dn) => ({ dn, st: dnStatus(s, dn, dn.month) })));
    const billing = myDn.some((x) => !x.st.ok && !x.st.cutoff) || !!o.flags.shortUntracked && myDn.some((x) => !x.st.ok);
    const cutoff = myDn.some((x) => x.st.cutoff);
    const row = { id: o.id, dealer: o.dealer, credit: !!o.flags.creditBreach, discount: !!o.flags.discountBreach, billing, cutoff,
      intake: !!o.flags.intakeError, override: !!o.override, stage: o.stage };
    row.any = row.credit || row.discount || row.billing || row.cutoff || row.intake;
    return row;
  });
  const exceptions = grid.length ? grid.filter((r) => r.any).length / grid.length : 0;

  const kv = {
    creditBreach: released.length ? breaches.length / released.length : 0,
    overrideDocs: overrides.length ? overrides.filter((x) => x.documented).length / overrides.length : 1,
    discountOk: discounted.length ? 1 - discBreach.length / discounted.length : 1,
    mdChanges: mdUnauth.length, rightFirst: rightFirst ?? 1, dni, unapplied, overdue: overduePct, cycle, touches, exceptions,
  };
  const kpis = D.KPIS.map((k) => { const p = kpiProgress(k, kv[k.id]); return { ...k, val: kv[k.id], p, stars: stars(p) }; });
  const score = Math.round(100 * sum(kpis, (k) => k.p ?? 0) / kpis.length);

  // P&L: the truth (earned) basis
  const projInv = s.invoices.filter((i) => i.project && inM(i.day));
  const projRev = sum(projInv, (i) => i.amount);
  const projCost = projInv.length ? sum(projInv, (i) => i.amount / D.PROJECT.price * D.PROJECT.unitCost) : 0;
  const cogs = sum(dns, (x) => x.cost);
  const exp = s.expenses.filter((e) => inM(e.day) && !NON_PL.has(e.type));
  const byType = {};
  for (const e of exp) byType[e.type] = (byType[e.type] || 0) + e.amount;
  const opex = sum(exp, (e) => e.amount);
  const profit = correct + projRev - cogs - projCost - opex;
  const erpProfit = booked + projRev - cogs - projCost - opex;

  // what went wrong, in words
  const issues = [];
  for (const o of breaches) issues.push({ c: 'credit', t: `${o.id} (${D.DEALERS[o.dealer].short}) released against P1: exposure ${n0(o.credit.pol.exposure)} vs approved limit ${n0(o.credit.pol.limit)}${o.credit.pol.overdue ? `, ${n0(o.credit.pol.overdue)} overdue` : ''}. Released by ${o.releasedBy === 'SE' ? 'a Sales Executive' : o.releasedBy}.` });
  for (const o of discBreach) issues.push({ c: 'price', t: `${o.id}: ${Math.round(o.disc * 100)}% discount approved by ${o.approver === 'SE' ? 'a Sales Executive' : 'the Sales Manager'}; policy needs ${o.reqApprover === 'GMFM' ? 'GM + FM' : 'the Sales Manager'}.${o.belowFloor ? ` ${n0(o.belowFloor)} below floor price.` : ''}` });
  for (const c of mdUnauth) issues.push({ c: 'ctrl', t: `Unapproved credit-limit change: ${D.DEALERS[c.dealer].short} ${n0(c.from)} → ${n0(c.to)} on ${fmtDay(c.day)}${c.reverted ? ` (reversed ${fmtDay(c.reverted)})` : ''}.` });
  for (const x of dnInfo.filter((y) => !y.st.ok)) issues.push({ c: x.st.cutoff ? 'rev' : 'bill', t: `${x.dn.dn} (${x.dn.order}, ${n0(x.dn.value)}): ${x.st.issue}.` });
  for (const r of unappliedList) issues.push({ c: 'cash', t: `${r.id} (${n0(r.amount)} from ${D.DEALERS[r.dealer].short}) still on suspense at month end.` });
  for (const o of orders.filter((x) => x.stage === 'cancelled')) issues.push({ c: 'credit', t: `${o.id} cancelled by the dealer (lost sale ${n0(o.value)}).` });
  for (const o of orders.filter((x) => x.flags.shortUntracked)) issues.push({ c: 'bill', t: `${o.id}: shortage shipped but not recorded; ERP stock now wrong.` });
  for (const o of orders.filter((x) => x.flags.intakeError)) issues.push({ c: 'ctrl', t: `${o.id}: order typed with the wrong quantity.` });
  for (const e of exp.filter((x) => x.type === 'writeoff_hidden' || x.type === 'baddebt')) issues.push({ c: 'credit', t: `${e.label}: ${n0(e.amount)}.` });
  if (snap.dealers) for (const id of D.DEALER_IDS) if (snap.dealers[id].overdue > 0) issues.push({ c: 'cash', t: `${D.DEALERS[id].short} has ${n0(snap.dealers[id].overdue)} overdue (oldest ${snap.dealers[id].oldest} days late).` });

  const changes = s.changeLog.filter((c) => inM(c.day));
  return {
    m, monthName: monthName(m), closedDay: Math.floor(s.t / 1440), orders: orders.length, released: released.length,
    delivered: dns.length, booked, correct, gap: correct - booked, gross, grossErrPct, auditFail: grossErrPct > 0.10, recon,
    erpAR: snap.erpAR, trueAR: snap.trueAR, overdue: snap.overdue, suspense: snap.suspense, cash: snap.cash,
    dealers: snap.dealers, stock: snap.stock, kpis, score, grid, issues, changes, projRev, projCost, cogs, opex, byType,
    profit, erpProfit, stages, waitDays, holdDays, project: s.project ? { ...s.project, log: undefined } : null,
  };
}

export function finalScore(s) {
  const reps = s.reports.filter((r) => r.m >= 1 && r.m <= 3);
  const use = reps.length ? reps : s.reports;
  const kpiAvg = use.length ? sum(use, (r) => r.score) / use.length : 0;
  const profit = sum(s.reports.filter((r) => r.m <= 3), (r) => r.profit);
  const kpiPts = Math.round(kpiAvg * 10);
  const profitPts = Math.round(profit / 1000);
  const cashPts = Math.round(s.cash / 2000);
  const total = kpiPts + profitPts + cashPts;
  const grade = total >= 1100 ? 'S' : total >= 900 ? 'A' : total >= 700 ? 'B' : total >= 500 ? 'C' : 'D';
  const quiz = s.answers.length ? s.answers.filter((a) => a.correct).length + ' of ' + s.answers.length : 'none answered';
  return { kpiAvg: Math.round(kpiAvg), profit, kpiPts, profitPts, cashPts, total, grade, quiz };
}

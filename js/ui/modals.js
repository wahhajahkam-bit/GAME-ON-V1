// Modal windows: start, question, order detail, dealer, month report, final, menu, change confirm.
import * as D from '../data.js';
import { dayOf, fmtDay, fmtT, monthName } from '../sim/time.js';
import { dealerBalance, dealerOverdue, findOption, findControl } from '../sim/sim.js';
import { finalScore } from '../sim/report.js';
import { n0, fmtK } from './panels.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (x) => Math.round(x * 100) + '%';
const starStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const close = '<button class="close" data-act="close" aria-label="Close">✕</button>';

export function startModal(hasSave) {
  return `<h2>Zenith Cooling Supplies: Order-to-Cash</h2>
  <p>It is <b>1 March 2025</b> in Dubai. Zenith buys split air conditioners and sells them on credit to four dealers. Sales are growing, but the CFO, <b>Ms. Farah</b>, is worried: cash is lower than expected, one dealer was billed for units it never received, and the auditors want to know why some March deliveries were never invoiced.</p>
  <p>You are the process consultant. Watch the business run exactly as described in the case, pause to inspect anything, then change how each of the 11 steps works. Every change costs money and takes time. Learn when money is really counted along the way.</p>
  <div class="mode">
    <button data-act="start" data-mode="campaign"><b>Campaign</b>March to June. Hit your KPI targets, keep profit and cash healthy, and pass the audits. Fail two audits or run out of cash and you lose.</button>
    <button data-act="start" data-mode="sandbox"><b>Sandbox</b>No winning or losing. Run as many months as you like and experiment freely.</button>
    ${hasSave ? '<button data-act="load"><b>Continue</b>Load your saved game.</button>' : ''}
  </div>
  <label class="row"><input type="checkbox" id="optQ" checked> Pop-up finance questions ("when is money counted?")</label>
  <h3 style="margin-top:12px">How to play</h3>
  <ul class="hint" style="margin:6px 0 0;padding-left:18px">
    <li><b>Speed:</b> ❚❚ pause · 1× (a day takes 5 minutes) · 2.5× (2 minutes) · 5× (1 minute) · +1 day · Skip month. Keys: Space, 1, 2, 3.</li>
    <li><b>Map:</b> tap any area to open its step, an order box to follow its money, a person to see their task, a dealer card for its account.</li>
    <li><b>Steps tab:</b> each step shows today, the policy, what is happening now, and the options you can switch to.</li>
    <li><b>Books tab:</b> what the ERP says next to the truth. <b>Reports:</b> a full month-end report on the 3rd of each month.</li>
    <li>Figures marked as assumptions (opening stock, cash, salaries, unit costs, the hotel project) are not in the case; everything in March comes from Exhibits A–H.</li>
  </ul>`;
}

export function questionModal(id, answered) {
  const q = D.QUESTIONS[id];
  const concept = D.CONCEPTS.find((c) => c.id === q.concept);
  let h = `<span class="tag" style="--c:var(--rev)">When is money counted?</span><h2 style="margin-top:8px">${q.title}</h2><p style="font-size:15px">${q.q}</p>`;
  q.options.forEach((o, i) => {
    const cls = answered != null ? (i === q.answer ? 'right' : i === answered ? 'wrong' : '') : '';
    h += `<button class="qopt ${cls}" data-act="answer" data-q="${id}" data-i="${i}" ${answered != null ? 'disabled' : ''}>${String.fromCharCode(65 + i)}. ${esc(o)}</button>`;
  });
  if (answered != null) {
    h += `<div class="explain"><b>${answered === q.answer ? 'Right.' : 'Not quite.'}</b> ${q.explain}</div>`;
    if (concept) h += `<div class="cc" style="--c:var(--${concept.c});margin-top:10px"><h3>${concept.t}</h3><div>${concept.d}</div><div class="f">${concept.f}</div></div>`;
    h += `<div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn" data-act="close">Continue</button></div>`;
  }
  return h;
}

export function orderModal(s, id) {
  const o = s.orders.find((x) => x.id === id);
  if (!o) return close + '<p>Order not found.</p>';
  const dns = s.deliveries.filter((x) => x.order === id);
  const invs = s.invoices.filter((i) => i.order === id);
  const paidTrue = invs.reduce((a, i) => a + i.truePaid, 0), paidErp = invs.reduce((a, i) => a + i.erpPaid, 0);
  const delivered = dns.reduce((a, x) => a + x.value, 0), invoiced = invs.reduce((a, i) => a + i.amount - i.cn, 0);
  const stage = (label, done, val, c) => `<div style="--c:var(--${c});opacity:${done ? 1 : 0.45}"><b>${label}</b>${val}</div>`;
  const cr = o.credit;
  return `${close}<span class="tag" style="--c:${D.DEALERS[o.dealer].color}">${D.DEALERS[o.dealer].name}</span>
  <h2 style="margin-top:8px">${o.id}: ${o.qty} × ${o.product}</h2>
  <p class="hint">Ordered ${fmtT(o.arriveT)} · price ${n0(o.price)}${o.disc ? ` (${Math.round(o.disc * 100)}% off list ${n0(D.PRODUCTS[o.product].list)})` : ''} · value ${n0(o.value)} · status: <b>${o.stage}</b></p>
  <h3>Money tracker</h3>
  <div class="timeline" style="margin:6px 0 12px">
    ${stage('Order', true, 'Nothing booked', 'price')}
    ${stage('Delivered', dns.length, dns.length ? `Revenue ${n0(delivered)}` : 'Not yet', 'rev')}
    ${stage('Invoiced', invs.length, invs.length ? `${n0(invoiced)}${invoiced !== delivered ? ` <span class="k-bad">(${invoiced > delivered ? '+' : ''}${n0(invoiced - delivered)})</span>` : ''}` : 'Not yet', 'bill')}
    ${stage('In the bank', paidTrue > 0, paidTrue ? `Cash ${n0(paidTrue)}` : 'Not yet', 'cash')}
    ${stage('Applied', paidErp > 0, paidErp ? `${n0(paidErp)} cleared` : paidTrue ? '<span class="k-warn">On suspense</span>' : 'Not yet', 'ctrl')}
  </div>
  ${cr ? `<div class="card"><h3>Credit check</h3><table><tr><th></th><th class="r">Balance</th><th class="r">+ Order</th><th class="r">Exposure</th><th class="r">Limit</th><th class="r">Overdue</th><th>Result</th></tr>
    <tr><td>ERP saw</td><td class="r mono">${n0(cr.erp.bal)}</td><td class="r mono">${n0(o.value)}</td><td class="r mono">${n0(cr.erp.exposure)}</td><td class="r mono">${n0(cr.erp.limit)}</td><td class="r mono">${n0(cr.erp.overdue)}</td><td>${cr.erp.fail ? '<span class="pill warn">Fail</span>' : '<span class="pill good">Pass</span>'}</td></tr>
    <tr><td>Policy P1</td><td class="r mono">${n0(cr.pol.bal)}</td><td class="r mono">${n0(o.value)}</td><td class="r mono">${n0(cr.pol.exposure)}</td><td class="r mono">${n0(cr.pol.limit)}</td><td class="r mono">${n0(cr.pol.overdue)}</td><td>${cr.pol.fail ? '<span class="pill bad">Hold</span>' : '<span class="pill good">Release</span>'}</td></tr></table>
    <p class="hint">Policy uses the approved limit and all cash received (even if not yet matched). The ERP uses whatever limit is typed in and only matched cash.</p></div>` : ''}
  <h3>What happened</h3>
  <div class="olog">${o.log.map((e) => `<div class="e"><time>${fmtT(e.t)}</time><div>${esc(e.text)}${e.money ? `<div class="money">${e.money.map((m) => `<div>${esc(m)}</div>`).join('')}</div>` : ''}</div></div>`).join('')}</div>`;
}

export function dealerModal(s, id) {
  const dd = D.DEALERS[id], dl = s.dealers[id], d = dayOf(s.t);
  const invs = s.invoices.filter((i) => i.dealer === id).sort((a, b) => a.day - b.day);
  const rec = s.receipts.filter((r) => r.dealer === id);
  return `${close}<span class="tag" style="--c:${dd.color}">${dd.emirate}</span><h2 style="margin-top:8px">${dd.name}</h2>
  <div class="grid2"><div class="mini"><small>Approved limit</small><b>${n0(dl.approvedLimit)}</b></div><div class="mini ${dl.erpLimit !== dl.approvedLimit ? 'bad' : ''}"><small>Limit in ERP</small><b>${n0(dl.erpLimit)}</b></div>
  <div class="mini"><small>Owes (ERP)</small><b>${n0(dealerBalance(s, id, 'erp'))}</b></div><div class="mini"><small>Owes (all cash counted)</small><b>${n0(dealerBalance(s, id, 'true'))}</b></div>
  <div class="mini ${dealerOverdue(s, id, 'true', d) ? 'bad' : ''}"><small>Overdue</small><b>${n0(dealerOverdue(s, id, 'true', d))}</b></div><div class="mini"><small>Terms / happiness</small><b>${dd.terms}d / ${Math.round(dl.sat)}</b></div></div>
  <h3 style="margin-top:12px">Invoices</h3><div class="scroll"><table><tr><th>Invoice</th><th>Date</th><th>Due</th><th class="r">Amount</th><th class="r">Credit notes</th><th class="r">Paid</th><th class="r">Open</th></tr>
  ${invs.map((i) => { const open = i.amount - i.cn - i.truePaid - i.writtenOff; return `<tr><td>${i.id}</td><td>${fmtDay(i.day)}</td><td>${fmtDay(i.due)}</td><td class="r mono">${n0(i.amount)}</td><td class="r mono">${n0(i.cn)}</td><td class="r mono">${n0(i.truePaid)}</td><td class="r mono ${open > 0 && d > i.due ? 'k-bad' : ''}">${n0(open)}</td></tr>`; }).join('')}</table></div>
  <h3 style="margin-top:12px">Payments</h3><table><tr><th>Receipt</th><th>Date</th><th class="r">Amount</th><th>Reference</th><th>Applied</th></tr>
  ${rec.map((r) => `<tr><td>${r.id}</td><td>${fmtDay(r.day)}</td><td class="r mono">${n0(r.amount)}</td><td>${r.ref || '<span class="k-warn">none</span>'}</td><td>${r.applied ? fmtDay(r.appliedDay) : '<span class="pill warn">Suspense</span>'}</td></tr>`).join('') || '<tr><td colspan="5">None</td></tr>'}</table>`;
}

export function reportModal(s, m) {
  const r = s.reports.find((x) => x.m === m);
  if (!r) return close + 'No report.';
  const verdict = r.auditFail ? (r.auditWarning ? '<span class="pill warn">Auditors: warning</span>' : `<span class="pill bad">Auditors: rejected (strike ${r.strike})</span>`) : '<span class="pill good">Auditors: accepted</span>';
  const kpis = r.kpis.map((k) => `<div class="kpi"><span>${k.name}</span><span class="v">${fmtK(k, k.base)}</span><span class="v"><b>${fmtK(k, k.val)}</b></span><span class="v tg">${fmtK(k, k.target)}</span><span class="stars">${starStr(k.stars)}</span></div>`).join('');
  const grid = r.grid.map((g) => `<div>${g.id}</div>${['credit', 'discount', 'billing', 'cutoff'].map((k) => `<div class="x ${g[k] ? 'on' : ''}" title="${k}"></div>`).join('')}<div class="x ${g.override ? 'ov' : ''}" title="approved override"></div>`).join('');
  const recon = r.recon.map((x) => `<tr><td>${x.dn}</td><td>${x.order}</td><td class="r mono">${n0(x.earned)}</td><td class="r mono">${n0(x.booked)}</td><td class="r mono ${x.diff ? 'k-bad' : ''}">${x.diff > 0 ? '+' : ''}${n0(x.diff)}</td></tr>`).join('');
  const changes = r.changes.map((c) => { const o = findOption(c.key, c.value); const ctl = findControl(c.key); return `<li>${fmtDay(c.day)}: ${ctl ? ctl.label : c.key} → ${o ? o.label : c.value}${c.cost ? ` (${n0(c.cost)})` : ''}${c.live ? ' <span class="pill good">live</span>' : ''}</li>`; }).join('');
  const dealers = r.dealers ? D.DEALER_IDS.map((id) => `<tr><td>${D.DEALERS[id].short}</td><td class="r mono">${n0(r.dealers[id].erp)}</td><td class="r mono">${n0(r.dealers[id].tru)}</td><td class="r mono ${r.dealers[id].overdue ? 'k-bad' : ''}">${n0(r.dealers[id].overdue)}</td><td class="r mono">${r.dealers[id].oldest || '–'}</td></tr>`).join('') : '';
  const bt = r.byType || {};
  return `${close}<span class="tag" style="--c:var(--rev)">Month-end report</span><h2 style="margin-top:8px">${r.monthName}</h2>
  <div class="row">${verdict}<span class="pill info">KPI score ${r.score}/100</span><span class="hint">Closed ${fmtDay(r.closedDay)}</span></div>
  <div class="grid2" style="margin-top:10px">
    <div class="mini"><small>Orders</small><b>${r.orders}</b></div><div class="mini"><small>ERP revenue</small><b>${n0(r.booked)}</b></div>
    <div class="mini"><small>Correct revenue</small><b>${n0(r.correct)}</b></div><div class="mini ${r.gap ? 'bad' : 'good'}"><small>Gap (gross error ${pct(r.grossErrPct)})</small><b>${r.gap > 0 ? '+' : ''}${n0(r.gap)}</b></div>
    <div class="mini"><small>Receivables (books / true)</small><b>${n0(r.erpAR)} / ${n0(r.trueAR)}</b></div><div class="mini ${r.overdue ? 'bad' : ''}"><small>Overdue</small><b>${n0(r.overdue)}</b></div>
    <div class="mini"><small>Cash at month end</small><b>${n0(r.cash)}</b></div><div class="mini ${r.profit < 0 ? 'bad' : 'good'}"><small>True profit</small><b>${n0(r.profit)}</b></div>
  </div>
  <h3 style="margin-top:14px">What went wrong</h3>
  ${r.issues.length ? `<ul style="margin:6px 0;padding-left:18px">${r.issues.map((i) => `<li style="color:var(--${i.c === 'cash' ? 'ink' : 'ink'})"><span class="pill" style="background:var(--${i.c === 'bill' ? 'bill' : i.c})">${{ credit: 'Credit', price: 'Discount', ctrl: 'Control', bill: 'Billing', rev: 'Cut-off', cash: 'Cash' }[i.c] || i.c}</span> ${esc(i.t)}</li>`).join('')}</ul>` : '<p class="k-good">Nothing. A clean month.</p>'}
  <h3 style="margin-top:14px">KPIs</h3><div class="kpi h"><span>KPI</span><span class="v">Baseline</span><span class="v">This month</span><span class="v tg">Target</span><span></span></div>${kpis}
  <h3 style="margin-top:14px">Revenue: booked vs earned</h3>
  ${recon ? `<div class="scroll"><table><tr><th>Delivery</th><th>Order</th><th class="r">Earned</th><th class="r">Booked</th><th class="r">Difference</th></tr>${recon}</table></div>` : '<p class="k-good">Every delivery was invoiced correctly, in the right month.</p>'}
  <h3 style="margin-top:14px">Exception map</h3>
  <div class="gridx"><div class="h">Order</div><div class="h">Credit</div><div class="h">Discount</div><div class="h">Billing</div><div class="h">Cut-off</div><div class="h">FM override</div>${grid}</div>
  <h3 style="margin-top:14px">Profit (true, by delivery)</h3>
  <table><tr><td>Revenue earned (dealers)</td><td class="r mono">${n0(r.correct)}</td></tr>${r.projRev ? `<tr><td>Revenue earned (hotel project)</td><td class="r mono">${n0(r.projRev)}</td></tr>` : ''}
  <tr><td>Cost of goods delivered</td><td class="r mono">−${n0(r.cogs + r.projCost)}</td></tr>
  ${Object.entries(bt).map(([k, v]) => `<tr><td>${{ salaries: 'Salaries', rent: 'Rent and utilities', change: 'Set-up of changes', running: 'Running cost of systems', hiring: 'Recruitment', stockloss: 'Stock lost or damaged', baddebt: 'Bad debt', writeoff_hidden: 'Unapproved credit notes' }[k] || k}</td><td class="r mono">−${n0(v)}</td></tr>`).join('')}
  <tr><td><b>Profit</b></td><td class="r mono"><b>${n0(r.profit)}</b></td></tr><tr><td class="hint">Profit as the ERP books show it</td><td class="r mono hint">${n0(r.erpProfit)}</td></tr></table>
  ${dealers ? `<h3 style="margin-top:14px">Dealer balances at month end</h3><table><tr><th>Dealer</th><th class="r">ERP</th><th class="r">True</th><th class="r">Overdue</th><th class="r">Oldest (days)</th></tr>${dealers}</table>` : ''}
  <h3 style="margin-top:14px">Changes you made</h3>${changes ? `<ul style="margin:6px 0;padding-left:18px">${changes}</ul>` : '<p class="hint">None this month.</p>'}
  <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn" data-act="close">Continue</button></div>`;
}

export function finalModal(s) {
  const f = finalScore(s);
  const lose = s.over.result === 'lose';
  return `<span class="tag" style="--c:var(--${lose ? 'bad' : 'good'})">${lose ? 'Game over' : 'Campaign complete'}</span>
  <h2 style="margin-top:8px">${lose ? 'The CFO has stopped the project' : 'Your recommendation is in'}</h2><p>${esc(s.over.reason)}</p>
  <div class="row" style="align-items:flex-end;gap:18px"><div><small>Grade</small><div class="big">${f.grade}</div></div><div><small>Total</small><div class="big">${f.total}</div></div></div>
  <table style="margin-top:8px"><tr><td>KPI score (average April–June) ${f.kpiAvg}/100 × 10</td><td class="r mono">${f.kpiPts}</td></tr>
  <tr><td>True profit ${n0(f.profit)} ÷ 1,000</td><td class="r mono">${f.profitPts}</td></tr><tr><td>Cash in the bank ${n0(s.cash)} ÷ 2,000</td><td class="r mono">${f.cashPts}</td></tr>
  <tr><td><b>Total</b></td><td class="r mono"><b>${f.total}</b></td></tr></table>
  <p class="hint">Grades: S 1,100+ · A 900+ · B 700+ · C 500+ · D below. Finance questions right: ${f.quiz}.</p>
  <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost" data-act="tab" data-tab="reports">See all reports</button><button class="btn ghost" data-act="sandbox">Keep playing (sandbox)</button><button class="btn" data-act="new">New game</button></div>`;
}

export function menuModal(s, settings) {
  return `${close}<h2>Menu</h2>
  <div class="row" style="margin:10px 0"><button class="btn" data-act="save">Save game</button><button class="btn ghost" data-act="load">Load saved game</button><button class="btn ghost" data-act="new">New game</button></div>
  <label class="row"><input type="checkbox" data-act="toggleQ" ${s.settings.questions ? 'checked' : ''}> Pop-up finance questions</label>
  <label class="row"><input type="checkbox" data-act="toggleSound" ${settings.sound ? 'checked' : ''}> Sound effects</label>
  <div class="row" style="margin:8px 0">Theme: <button class="btn small ghost" data-act="theme" data-theme="">Auto</button><button class="btn small ghost" data-act="theme" data-theme="light">Light</button><button class="btn small ghost" data-act="theme" data-theme="dark">Dark</button></div>
  <h3 style="margin-top:12px">Assumptions (not in the case)</h3>
  <ul class="hint" style="padding-left:18px;margin:6px 0">
    <li>Opening stock: AC1 70, AC2 22 on the shelf (ERP says 25), AC3 45. Chosen so DN-505 could only ship 12 AC2.</li>
    <li>Unit costs: AC1 1,000 · AC2 1,300 · AC3 1,600. Automatic reorder from the manufacturer, 14 days, paid on arrival.</li>
    <li>Opening cash 200,000. Rent 6,000/month. Salaries as shown in the Staff tab.</li>
    <li>April onward: orders generated with the same dealers and products. Dealer payment habits follow their March behaviour.</li>
    <li>Al Bahar Hotel project: a scaled version of "100M project, 60M materials, 20M advance" (250,000 / 150,000 / 50,000).</li>
    <li>Auditors reject a month when revenue errors exceed 10% of correct revenue. March only gives a warning.</li>
  </ul>
  <p class="hint">Mode: ${s.mode} · seed ${s.seed}</p>`;
}

export function confirmModal(s, key, v) {
  const o = findOption(key, v); const c = findControl(key);
  return `${close}<span class="tag" style="--c:var(--ctrl)">Change a step</span><h2 style="margin-top:8px">${esc(o.label)}</h2>
  <p>${esc(c.label)}</p><p>${esc(o.effect)}</p>
  <div class="grid2"><div class="mini"><small>Set-up cost</small><b>${n0(o.cost)}</b></div><div class="mini"><small>Set-up time</small><b>${o.days ? o.days + ' days' : 'instant'}</b></div><div class="mini"><small>Running cost</small><b>${o.monthly ? n0(o.monthly) + '/mo' : '0'}</b></div><div class="mini"><small>Cash now</small><b>${n0(s.cash)}</b></div></div>
  <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" data-act="confirm" data-key="${key}" data-v="${v}">${o.cost ? 'Pay ' + n0(o.cost) + ' and start' : 'Start'}</button></div>`;
}

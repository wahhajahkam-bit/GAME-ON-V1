// Side-panel tabs. Each function returns HTML for the panel.
import * as D from '../data.js?v=6';
import { dayOf, monthOf, monthFirst, fmtDay, fmtT, monthName } from '../sim/time.js?v=6';
import { dealerBalance, dealerOverdue, oldestOverdueDays, snapshot, findOption, canChoose, headcount, suggestedLimit } from '../sim/sim.js?v=6';
import { computeMonthReport, stars } from '../sim/report.js?v=6';
import { questionById } from '../sim/weekly.js?v=6';
import { staffName } from '../render/map.js?v=6';

export const n0 = (x) => (x == null ? '–' : Math.round(x).toLocaleString('en-US'));
const pct = (x) => (x == null ? '–' : Math.round(x * 100) + '%');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fmtK = (k, v) => (v == null ? '–' : k.fmt === 'pct' ? pct(v) : k.fmt === 'aed' ? n0(v) : k.fmt === 'num' ? (Math.round(v * 10) / 10).toString() : String(v));
const starStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const curMonth = (s) => monthOf(dayOf(s.t));

export const TABS = [
  ['steps', 'Steps'], ['erp', 'ERP'], ['orders', 'Orders'], ['books', 'Books'], ['kpis', 'KPIs'],
  ['charts', 'Charts'], ['staff', 'Staff'], ['events', 'Events'], ['reports', 'Reports'], ['learn', 'Learn'],
];

// ---------- Steps ----------
function stepStatus(s, st) {
  const pend = st.controls.some((c) => s.pending[c.key]);
  const changed = st.controls.some((c) => c.options && s.controls[c.key] !== D.DEFAULT_CONTROLS[c.key]);
  if (pend) return '<span class="pill warn">Setting up</span>';
  if (changed) return '<span class="pill good">Changed</span>';
  return '<span class="pill mute">Today</span>';
}

export function stepNow(s, id) {
  const m = curMonth(s), f = monthFirst(m), d = dayOf(s.t);
  const ordersM = s.orders.filter((o) => o.day >= f);
  switch (id) {
    case 'intake': {
      const errs = ordersM.filter((o) => o.flags.intakeError).length, lost = ordersM.filter((o) => o.flags.lostMsg).length;
      return { line: `${ordersM.length} orders this month · ${errs} typing errors · ${lost} lost messages`,
        html: `<b>${ordersM.length}</b> orders this month. Typing errors: <b>${errs}</b>. Missed messages: <b>${lost}</b>.<br>Volume setting: ${s.controls.volume}% (applies from next month).` };
    }
    case 'pricing': {
      const disc = ordersM.filter((o) => o.disc > 0 && o.approver), br = disc.filter((o) => o.flags.discountBreach);
      const floor = ordersM.reduce((a, o) => a + (o.belowFloor || 0), 0);
      return { line: `${disc.length} discounted · ${br.length} approved at the wrong level · ${n0(floor)} below floor`,
        html: `Discounted orders this month: <b>${disc.length}</b>. Approved by the wrong person: <b class="${br.length ? 'k-bad' : ''}">${br.length}</b>${br.length ? ' (' + br.map((o) => o.id).join(', ') + ')' : ''}. Sold below floor price: <b>${n0(floor)}</b>.` };
    }
    case 'credit': {
      const held = s.orders.filter((o) => o.stage === 'held'), rel = s.orders.filter((o) => o.released && o.releaseDay >= f);
      const br = rel.filter((o) => o.flags.creditBreach), ov = s.overrides.filter((x) => x.day >= f);
      return { line: `${held.length} on hold now · ${rel.length} released this month · ${br.length} broke P1`,
        html: `On credit hold now: <b>${held.length}</b>${held.length ? ' (' + held.map((o) => o.id).join(', ') + ')' : ''}. Released this month: <b>${rel.length}</b>, of which broke P1: <b class="${br.length ? 'k-bad' : ''}">${br.length}</b>${br.length ? ' (' + br.map((o) => o.id).join(', ') + ')' : ''}. FM overrides: <b>${ov.length}</b>.` };
    }
    case 'md': {
      const un = s.mdChanges.filter((c) => !c.approved && !c.rejected && !c.reverted);
      return { line: `${un.length} unapproved limit change${un.length === 1 ? '' : 's'} live in the ERP`,
        html: un.length ? `Unapproved changes live in the ERP: ${un.map((c) => `<b class="k-bad">${D.DEALERS[c.dealer].short} ${n0(c.from)} → ${n0(c.to)}</b> (${fmtDay(c.day)})`).join(', ')}` : 'No unapproved changes live in the ERP.' };
    }
    case 'warehouse': {
      const wait = s.orders.filter((o) => o.stage === 'warehouse');
      const bo = s.orders.filter((o) => o.backorder > 0);
      const rows = D.PRODUCT_IDS.map((p) => {
        const st = s.stock[p]; const vis = s.controls.count === 'scan' ? st.real : st.lastCount ? st.lastCount.real + '*' : '?';
        return `<tr><td>${p}</td><td class="r mono">${st.sys}</td><td class="r mono">${vis}</td><td class="r mono">${s.onOrder[p] || 0}</td></tr>`;
      }).join('');
      return { line: `${wait.length} orders in the warehouse · ${bo.length} back-orders`,
        html: `<table><tr><th>Item</th><th class="r">ERP says</th><th class="r">Real (known)</th><th class="r">On order</th></tr>${rows}</table>
        <div class="hint">"?" = nobody has counted, so nobody knows. * = at the last count. Orders waiting to ship: ${wait.length}. Back-orders: ${bo.length}.</div>` };
    }
    case 'pod': {
      const out = s.deliveries.filter((x) => x.podDay == null).length;
      return { line: `${out} signed notes not yet back in the office`, html: `Signed delivery notes not yet back at the office: <b>${out}</b>.` };
    }
    case 'invoicing': {
      const wait = s.deliveries.filter((x) => !x.inv && !x.missed && !x.lost).length;
      const seen = s.controls.dni === 'on' || s.controls.cutoff === 'checklist';
      const missed = s.deliveries.filter((x) => x.missed && !x.inv && !x.lost).length;
      return { line: `${wait} deliveries waiting for an invoice run`,
        html: `Waiting for the next invoice run: <b>${wait}</b>. Forgotten deliveries: <b>${seen ? missed : '? (no report shows this)'}</b>.` };
    }
    case 'cutoff': {
      const snap = s.daily[s.daily.length - 1];
      return { line: s.controls.cutoff === 'checklist' ? 'Checklist runs on the last day' : 'No cut-off check',
        html: `This month so far: ERP booked <b>${n0(snap?.bookedMTD)}</b>, earned (delivered) <b>${n0(snap?.trueMTD)}</b>. ${s.controls.cutoff === 'checklist' ? 'The checklist will fix missing and wrong invoices on the last day.' : 'Nobody will compare these before the books close.'}` };
    }
    case 'cashapp': {
      const sus = s.receipts.filter((r) => r.suspense && !r.applied);
      return { line: `${sus.length} receipt${sus.length === 1 ? '' : 's'} on suspense (${n0(sus.reduce((a, r) => a + r.amount, 0))})`,
        html: sus.length ? `On suspense: ${sus.map((r) => `<b>${r.id}</b> ${n0(r.amount)} from ${D.DEALERS[r.dealer].short} (${fmtDay(r.day)})`).join(', ')}. The cash is in the bank, but the dealers still look like they owe it.` : 'Suspense list is empty.' };
    }
    case 'monitoring': {
      let od = 0; for (const id of D.DEALER_IDS) od += dealerOverdue(s, id, 'true', d);
      return { line: `${n0(od)} overdue across dealers · review ${s.controls.monitoring}`,
        html: D.DEALER_IDS.map((id) => `${D.DEALERS[id].short}: <b class="${dealerOverdue(s, id, 'true', d) ? 'k-bad' : ''}">${n0(dealerOverdue(s, id, 'true', d))}</b> overdue${oldestOverdueDays(s, id, d) ? ` (oldest ${oldestOverdueDays(s, id, d)} days)` : ''}`).join('<br>') };
    }
    case 'roles': {
      const hidden = s.creditNotes.filter((c) => c.hidden).length;
      return { line: s.controls.roles === 'split' ? 'Duties split' : 'One clerk invoices, books cash and issues credit notes',
        html: s.controls.roles === 'split' ? 'Cash application: Cash Application Officer. Credit notes: approved by the Finance Manager.' : `The Billing Clerk invoices, records cash and issues credit notes with no approval. Unapproved credit notes so far: <b>${s.controls.roles === 'split' ? hidden : '? (nobody checks)'}</b>.` };
    }
  }
  return { line: '', html: '' };
}

function optionHtml(s, st, c, o) {
  const live = s.controls[c.key] === o.v;
  const pend = s.pending[c.key] && s.pending[c.key].value === o.v;
  const chk = canChoose(s, c.key, o.v);
  const cost = o.cost ? `${n0(o.cost)} set-up` : 'free';
  const days = o.days ? `${o.days} day${o.days > 1 ? 's' : ''}` : 'instant';
  return `<button class="opt ${live ? 'live' : ''} ${pend ? 'pending' : ''}" data-act="choose" data-key="${c.key}" data-v="${o.v}" ${live && !s.pending[c.key] ? 'aria-pressed="true"' : ''}>
    <span class="ol">${esc(o.label)}${live ? ' <span class="pill good">Live</span>' : ''}${pend ? ` <span class="pill warn">Live ${fmtDay(dayOf(s.pending[c.key].t))}</span>` : ''}</span>
    <span class="oc">${cost} · ${days}${o.monthly ? ` · ${n0(o.monthly)}/mo` : ''}</span>
    <span class="oe">${esc(o.effect)}</span>${!chk.ok && !live ? `<span class="on">${esc(chk.why)}</span>` : ''}</button>`;
}

export function stepsTab(s, ui) {
  let h = `<div class="ph"><h2>The 11 steps</h2><span class="hint">Tap a step to see it and change it</span></div>
  <p class="lead">Each step shows how it works today, the policy, what is happening now, and the options you can switch to. Options cost money and take days to set up.</p>`;
  for (const st of D.STEPS) {
    const now = stepNow(s, st.id);
    const open = ui.openStep === st.id;
    h += `<details class="step" style="--c:var(--${st.color})" data-step="${st.id}" ${open ? 'open' : ''}>
      <summary><span class="num">${st.num}</span><span class="nm">${st.name}</span>${stepStatus(s, st)}<span class="live">${now.line}</span></summary>
      <div class="body">
        <div class="three"><div><b class="k">How it works today</b>${esc(st.today)}</div><div><b class="k">Policy</b>${esc(st.policy)}</div><div><b class="k">Now</b>${now.html}</div></div>`;
    for (const c of st.controls) {
      if (c.showIf && !Object.entries(c.showIf).every(([k, v]) => s.controls[k] === v || (s.pending[k] && s.pending[k].value === v))) continue;
      h += `<div class="ctl"><h4>${esc(c.label)}</h4>`;
      if (c.type === 'slider') {
        h += `<input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${s.controls[c.key]}" data-act="slider" data-key="${c.key}" aria-label="${esc(c.label)}">
          <div class="row hint"><span>${c.min}%</span><b data-out="${c.key}">${s.controls[c.key]}%</b><span>${c.max}%</span></div><div class="hint">${esc(c.effect)}</div>`;
      } else if (c.type === 'number') {
        h += `<input type="number" min="${c.min}" max="${c.max}" value="${s.controls[c.key]}" data-act="number" data-key="${c.key}" aria-label="${esc(c.label)}">`;
      } else for (const o of c.options) h += optionHtml(s, st, c, o);
      h += '</div>';
    }
    if (st.id === 'md') {
      h += `<div class="ctl"><h4>Approved credit limits (Finance Manager approves; always allowed)</h4><div class="scroll"><table>
        <tr><th>Dealer</th><th class="r">Approved</th><th class="r">In ERP</th><th class="r">Suggested</th><th>New limit</th></tr>
        ${D.DEALER_IDS.map((id) => { const dl = s.dealers[id];
          return `<tr><td>${D.DEALERS[id].short}${D.DEALERS[id].risky ? ' <span class="pill bad">slow payer</span>' : ''}</td><td class="r mono">${n0(dl.approvedLimit)}</td><td class="r mono ${dl.erpLimit !== dl.approvedLimit ? 'k-bad' : ''}">${n0(dl.erpLimit)}</td><td class="r mono">${n0(suggestedLimit(s, id))}</td>
          <td><div class="row"><input type="number" step="5000" min="0" value="${dl.approvedLimit}" data-limit="${id}" aria-label="New limit for ${D.DEALERS[id].short}"><button class="btn small" data-act="limit" data-dealer="${id}">Approve</button></div></td></tr>`; }).join('')}
      </table></div><div class="hint">Suggested = recent monthly sales × how long the dealer takes to pay ÷ 30 × 1.2. A higher limit means fewer holds, but more money at risk if the dealer cannot pay.</div></div>`;
    }
    h += '</div></details>';
  }
  return h;
}

// ---------- ERP ----------
export function erpTab(s) {
  const d = dayOf(s.t);
  const dealers = D.DEALER_IDS.map((id) => {
    const dl = s.dealers[id]; const bal = dealerBalance(s, id, 'erp'); const od = dealerOverdue(s, id, 'erp', d);
    const flag = bal > dl.erpLimit || od > 0;
    return `<tr><td>${id} ${D.DEALERS[id].short}</td><td class="r mono ${dl.erpLimit !== dl.approvedLimit ? 'k-bad' : ''}">${n0(dl.erpLimit)}</td><td class="r mono">${n0(bal)}</td><td class="r mono ${od ? 'k-bad' : ''}">${n0(od)}</td><td>${dl.status === 'defaulted' ? '<span class="pill bad">Closed</span>' : flag ? '<span class="pill warn">Warning</span>' : '<span class="pill good">OK</span>'}</td></tr>`;
  }).join('');
  const open = s.invoices.filter((i) => !i.project && i.amount - i.cn - i.erpPaid - i.writtenOff > 0).sort((a, b) => a.day - b.day);
  const inv = open.map((i) => `<tr><td>${i.id}</td><td>${i.dealer}</td><td>${fmtDay(i.day)}</td><td>${fmtDay(i.due)}</td><td class="r mono">${n0(i.amount - i.cn)}</td><td class="r mono ${d > i.due ? 'k-bad' : ''}">${n0(i.amount - i.cn - i.erpPaid - i.writtenOff)}</td></tr>`).join('');
  const sus = s.receipts.filter((r) => r.suspense && !r.applied);
  const ch = s.mdChanges.slice(-8).reverse().map((c) => `<tr><td>${fmtDay(c.day)}</td><td>${c.by}</td><td>${D.DEALERS[c.dealer].short} limit ${n0(c.from)} → ${n0(c.to)}</td><td>${c.approved ? '<span class="pill good">FM</span>' : c.rejected ? '<span class="pill mute">Rejected</span>' : c.reverted ? '<span class="pill warn">Reversed</span>' : '<span class="pill bad">None</span>'}</td></tr>`).join('');
  const held = s.orders.filter((o) => o.stage === 'held');
  return `<div class="ph"><h2>Inside the ERP</h2><span class="hint">What the system shows staff</span></div>
  <p class="lead">This is the business's own view. It can be wrong: the ERP only knows what people type in. Compare it with the Books tab.</p>
  <div class="card"><h3>Customers</h3><div class="scroll"><table><tr><th>Dealer</th><th class="r">Limit</th><th class="r">Owes</th><th class="r">Overdue</th><th>Status</th></tr>${dealers}</table></div></div>
  <div class="card"><h3>Credit hold queue (${held.length})</h3>${held.length ? `<table><tr><th>Order</th><th>Dealer</th><th class="r">Value</th><th>Since</th></tr>${held.map((o) => `<tr data-order="${o.id}" style="cursor:pointer"><td>${o.id}</td><td>${D.DEALERS[o.dealer].short}</td><td class="r mono">${n0(o.value)}</td><td>${fmtDay(o.heldDay)}</td></tr>`).join('')}</table>` : '<span class="hint">Empty.</span>'}</div>
  <div class="card"><h3>Stock (ERP)</h3><table><tr><th>Item</th><th class="r">On hand (ERP)</th><th class="r">On order</th><th class="r">Reorder at</th></tr>${D.PRODUCT_IDS.map((p) => `<tr><td>${p}</td><td class="r mono">${s.stock[p].sys}</td><td class="r mono">${s.onOrder[p]}</td><td class="r mono">${D.REORDER[p].rop}</td></tr>`).join('')}</table></div>
  <div class="card"><h3>Open invoices (${open.length})</h3><div class="scroll"><table><tr><th>Invoice</th><th>Dealer</th><th>Date</th><th>Due</th><th class="r">Amount</th><th class="r">Open (ERP)</th></tr>${inv || '<tr><td colspan="6">None</td></tr>'}</table></div></div>
  <div class="card"><h3>Suspense list (${sus.length})</h3>${sus.length ? `<table><tr><th>Receipt</th><th>Date</th><th>From (bank name)</th><th class="r">Amount</th></tr>${sus.map((r) => `<tr><td>${r.id}</td><td>${fmtDay(r.day)}</td><td>${D.DEALERS[r.dealer].name}</td><td class="r mono">${n0(r.amount)}</td></tr>`).join('')}</table>` : '<span class="hint">Empty.</span>'}</div>
  <div class="card"><h3>Change log (customer master data)</h3>${ch ? `<div class="scroll"><table><tr><th>Date</th><th>By</th><th>Change</th><th>Approved</th></tr>${ch}</table></div>` : '<span class="hint">No changes.</span>'}</div>`;
}

// ---------- Orders ----------
export function ordersTab(s, ui) {
  const m = curMonth(s), f = monthFirst(m);
  const filt = ui.orderFilter || 'month';
  let list = s.orders.slice();
  if (filt === 'month') list = list.filter((o) => o.day >= f);
  if (filt === 'open') list = list.filter((o) => !['delivered', 'cancelled'].includes(o.stage) || o.backorder);
  if (filt === 'problems') list = list.filter((o) => o.flags.creditBreach || o.flags.discountBreach || o.flags.intakeError || o.flags.shortUntracked || o.stage === 'held');
  list.reverse();
  const stageName = { inbox: 'Inbox', pricing: 'Pricing', credit: 'Credit check', held: 'On hold', warehouse: 'Warehouse', transit: 'On truck', delivered: 'Delivered', cancelled: 'Cancelled' };
  const rows = list.map((o) => {
    const fl = [o.flags.creditBreach && '<span class="pill bad">P1</span>', o.flags.discountBreach && '<span class="pill bad">P2</span>', o.flags.shortUntracked && '<span class="pill warn">Short</span>', o.flags.intakeError && '<span class="pill warn">Typo</span>', o.override && '<span class="pill good">FM</span>'].filter(Boolean).join(' ');
    const inv = s.invoices.filter((i) => i.order === o.id);
    return `<tr data-order="${o.id}" style="cursor:pointer"><td><b>${o.id}</b></td><td>${D.DEALERS[o.dealer].short}</td><td>${o.qty} × ${o.product}</td><td class="r mono">${n0(o.value)}</td><td>${stageName[o.stage] || o.stage}</td><td>${inv.map((i) => i.id).join(', ') || '–'}</td><td>${fl}</td></tr>`;
  }).join('');
  return `<div class="ph"><h2>Orders</h2>
    <select data-act="orderFilter" aria-label="Filter orders"><option value="month" ${filt === 'month' ? 'selected' : ''}>This month</option><option value="open" ${filt === 'open' ? 'selected' : ''}>Open</option><option value="problems" ${filt === 'problems' ? 'selected' : ''}>Problems</option><option value="all" ${filt === 'all' ? 'selected' : ''}>All</option></select></div>
    <p class="lead">Tap an order to follow its money: what is booked at each step, and when cash is really counted.</p>
    <div class="scroll"><table><tr><th>Order</th><th>Dealer</th><th>Items</th><th class="r">Value</th><th>Stage</th><th>Invoice</th><th>Flags</th></tr>${rows || '<tr><td colspan="7">No orders yet.</td></tr>'}</table></div>`;
}

// ---------- Books ----------
export function booksTab(s) {
  const d = dayOf(s.t), m = curMonth(s);
  const snap = snapshot(s, d, false);
  const stockErp = D.PRODUCT_IDS.reduce((a, p) => a + s.stock[p].sys * D.PRODUCTS[p].cost, 0);
  const stockReal = D.PRODUCT_IDS.reduce((a, p) => a + s.stock[p].real * D.PRODUCTS[p].cost, 0);
  const stockKnown = s.controls.count === 'scan';
  const rep = computeMonthReport(s, m, snapshot(s, d, true));
  const proj = s.project;
  const row = (label, a, b, note) => `<div>${label}${note ? `<div class="hint">${note}</div>` : ''}</div><div class="n">${a}</div><div class="n ${a !== b && b !== '?' ? 'diff' : ''}">${b}</div>`;
  return `<div class="ph"><h2>The books</h2><span class="hint">${monthName(m)}, to date</span></div>
  <p class="lead">Left: what the ERP says. Right: the truth, based on what was really delivered and received. The gap is the error.</p>
  <div class="card"><div class="books">
    <div class="h"></div><div class="h n">What the ERP says</div><div class="h n">The truth</div>
    ${row('Revenue this month', n0(snap.bookedMTD), n0(snap.trueMTD), 'ERP: invoices dated this month. Truth: goods delivered this month.')}
    ${proj ? row('Project revenue this month', n0(rep.projRev), n0(rep.projRev), 'Delivered units only; the advance is not revenue') : ''}
    ${row('Dealers owe us (receivables)', n0(snap.erpAR), n0(snap.trueAR), 'Opening + invoiced − received vs opening + delivered − received')}
    ${row('…of which overdue', n0(snap.overdue), n0(snap.overdue))}
    ${row('Cash on suspense (unmatched)', n0(snap.suspense), n0(0), 'In the bank, but not yet matched to a dealer')}
    ${row('Stock value (at cost)', n0(stockErp), stockKnown ? n0(stockReal) : '?', stockKnown ? '' : 'Real stock unknown until someone counts')}
    ${proj ? row('Advance from Al Bahar (liability)', n0(proj.liability), n0(proj.liability), 'Cash received for goods not yet delivered') : ''}
    ${row('Cash in the bank', n0(s.cash), n0(s.cash), 'Cash is the same in both: it is what the bank says')}
    ${row('Profit this month (so far)', n0(rep.erpProfit), n0(rep.profit), 'Revenue − cost of goods − salaries, rent, set-up costs, losses')}
  </div></div>
  <div class="card"><h3>When is money counted?</h3><div class="timeline">
    <div style="--c:var(--price)"><b>Order</b>Nothing booked. A promise.</div>
    <div style="--c:var(--rev)"><b>Delivery</b>Revenue + receivable. Stock out, cost of goods in.</div>
    <div style="--c:var(--bill)"><b>Invoice</b>A document. Starts the due date. Does not move revenue.</div>
    <div style="--c:var(--cash)"><b>Bank</b>Cash counted when it lands in the bank.</div>
    <div style="--c:var(--ctrl)"><b>Applied</b>Receivable cleared when matched to the invoice.</div>
  </div><p class="hint" style="margin:8px 0 0">Advance before delivery = cash + liability. Promise to pay = nothing. Dealer can never pay = bad-debt expense.</p></div>
  ${proj ? `<div class="card"><h3>${D.PROJECT.name}: where the money sits</h3><div class="grid2">
    <div class="mini"><small>Contract</small><b>${n0(proj.value)}</b></div><div class="mini"><small>Revenue so far</small><b>${n0(proj.revenue)}</b></div>
    <div class="mini"><small>Cost so far</small><b>${n0(proj.cost)}</b></div><div class="mini good"><small>Profit so far</small><b>${n0(proj.revenue - proj.cost)}</b></div>
    <div class="mini"><small>Advance left (liability)</small><b>${n0(proj.liability)}</b></div><div class="mini"><small>Hotel owes us</small><b>${n0(proj.ar)}</b></div></div>
    <div class="olog" style="margin-top:8px">${proj.log.map((l) => `<div class="e"><time>${fmtDay(l.day)}</time><span>${esc(l.text)}</span></div>`).join('')}</div></div>` : ''}`;
}

// ---------- KPIs ----------
export function kpisTab(s) {
  const d = dayOf(s.t), m = curMonth(s);
  const live = computeMonthReport(s, m, snapshot(s, d, true));
  const last = s.reports[s.reports.length - 1];
  const lastMap = last ? Object.fromEntries(last.kpis.map((k) => [k.id, k])) : {};
  const rows = live.kpis.map((k) => `<div class="kpi"><span>${k.name}</span><span class="v">${fmtK(k, k.base)}</span><span class="v">${last ? fmtK(k, lastMap[k.id].val) : '–'}</span><span class="v"><b>${fmtK(k, k.val)}</b></span><span class="v tg">${fmtK(k, k.target)} <span class="stars">${starStr(k.stars)}</span></span></div>`).join('');
  const st = D.stageTable(s.controls);
  return `<div class="ph"><h2>KPIs</h2><span class="hint">Score this month so far: <b>${live.score}</b>/100</span></div>
  <p class="lead">Baseline = March as found in the case. Stars show how far you have moved from baseline to target.</p>
  <div class="card"><div class="kpi h"><span>KPI</span><span class="v">March base</span><span class="v">${last ? last.monthName.split(' ')[0] : 'Last'}</span><span class="v">Now</span><span class="v tg">Target</span></div>${rows}</div>
  <div class="card"><h3>Cycle time and touches (Exhibit H)</h3><table><tr><th>Step</th><th class="r">Days</th><th class="r">Touches</th></tr>
  ${st.map((x) => `<tr><td>${x.step}</td><td class="r mono">${x.days}</td><td class="r mono">${x.touches}</td></tr>`).join('')}
  <tr><td><b>Total</b>${live.waitDays > 0.05 ? ` <span class="hint">+ ${(Math.round(live.waitDays * 10) / 10)} days waiting for busy staff</span>` : ''}</td><td class="r mono"><b>${Math.round(live.kpis.find((k) => k.id === 'cycle').val * 10) / 10}</b></td><td class="r mono"><b>${live.kpis.find((k) => k.id === 'touches').val}</b></td></tr></table>
  <p class="hint">Average days on credit hold (not in cycle time): ${Math.round(live.holdDays * 10) / 10}.</p></div>`;
}

// ---------- Charts ----------
export function chartsTab() {
  return `<div class="ph"><h2>Live statistics</h2><span class="hint">One point per day</span></div>
  <div class="card"><h3>Cash in the bank</h3><canvas class="chart" data-chart="cash"></canvas></div>
  <div class="card"><h3>Revenue this month: booked vs earned</h3><canvas class="chart" data-chart="rev"></canvas><div class="legend"><span style="--k:var(--muted)">ERP booked (invoices)</span><span style="--k:var(--rev)">Earned (deliveries)</span></div></div>
  <div class="card"><h3>What dealers owe</h3><canvas class="chart" data-chart="ar"></canvas><div class="legend"><span style="--k:var(--muted)">ERP</span><span style="--k:var(--cash)">Truth</span><span style="--k:var(--bad)">Overdue</span><span style="--k:var(--warn)">Suspense</span></div></div>
  <div class="card"><h3>Orders on hold and exceptions this month</h3><canvas class="chart" data-chart="ops"></canvas><div class="legend"><span style="--k:var(--warn)">On hold</span><span style="--k:var(--bad)">Exceptions</span></div></div>`;
}
export function drawCharts(root, s) {
  const css = getComputedStyle(document.documentElement);
  const c = (k) => css.getPropertyValue('--' + k).trim();
  const data = s.daily.slice(-120);
  const defs = {
    cash: [{ k: 'cash', c: c('cash') }],
    rev: [{ k: 'bookedMTD', c: c('muted') }, { k: 'trueMTD', c: c('rev') }],
    ar: [{ k: 'erpAR', c: c('muted') }, { k: 'trueAR', c: c('cash') }, { k: 'overdue', c: c('bad') }, { k: 'suspense', c: c('warn') }],
    ops: [{ k: 'held', c: c('warn') }, { k: 'exceptions', c: c('bad') }],
  };
  for (const cv of root.querySelectorAll('canvas[data-chart]')) {
    const series = defs[cv.dataset.chart];
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
    if (data.length < 2) { g.fillStyle = c('muted'); g.font = '12px Figtree'; g.fillText('Run the game for a day or two to see data.', 8, 20); continue; }
    let lo = 0, hi = 1;
    for (const sr of series) for (const p of data) { lo = Math.min(lo, p[sr.k]); hi = Math.max(hi, p[sr.k]); }
    const padL = 52, padB = 18, padT = 6;
    const X = (i) => padL + (i / (data.length - 1)) * (w - padL - 6);
    const Y = (v) => padT + (1 - (v - lo) / (hi - lo || 1)) * (h - padT - padB);
    g.strokeStyle = c('line'); g.lineWidth = 1; g.fillStyle = c('muted'); g.font = '10.5px "IBM Plex Mono", monospace';
    for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3; const y = Y(v); g.beginPath(); g.moveTo(padL, y); g.lineTo(w - 6, y); g.stroke(); g.textAlign = 'right'; g.fillText(Math.abs(v) >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v), padL - 6, y + 3); }
    g.textAlign = 'left';
    const step = Math.max(1, Math.floor(data.length / 5));
    for (let i = 0; i < data.length; i += step) g.fillText(fmtDay(data[i].d), X(i) - 12, h - 4);
    for (const sr of series) {
      g.strokeStyle = sr.c; g.lineWidth = 2; g.beginPath();
      data.forEach((p, i) => { const x = X(i), y = Y(p[sr.k]); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    }
    if (lo < 0) { g.strokeStyle = c('bad'); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(padL, Y(0)); g.lineTo(w - 6, Y(0)); g.stroke(); g.setLineDash([]); }
  }
}

// ---------- Staff ----------
export function staffTab(s) {
  const d = dayOf(s.t);
  const rows = D.ROLE_IDS.map((r) => {
    const n = headcount(s, r);
    let used = 0; for (let i = 0; i < Math.max(1, n); i++) used += s.cap[r + i + ':' + d] || 0;
    const load = n ? used / (n * 10) : 0;
    const pend = s.hires.filter((h) => h.role === r);
    return `<tr><td><b>${D.ROLES[r].name}</b>${pend.length ? `<div class="hint">+${pend.length} starting ${fmtDay(dayOf(pend[0].t))}</div>` : ''}</td><td class="r mono">${n}</td><td class="r mono">${n0(D.ROLES[r].salary)}</td>
      <td style="min-width:80px"><div class="bar" style="--c:${load > 0.9 ? 'var(--bad)' : load > 0.6 ? 'var(--warn)' : 'var(--good)'}"><i style="width:${Math.min(100, load * 100)}%"></i></div><span class="hint">${Math.round(load * 100)}%</span></td>
      <td><div class="row"><button class="btn small" data-act="hire" data-role="${r}">Hire</button>${n > 0 ? `<button class="btn small ghost" data-act="letgo" data-role="${r}">Let go</button>` : ''}</div></td></tr>`;
  }).join('');
  const pay = D.ROLE_IDS.reduce((a, r) => a + headcount(s, r) * D.ROLES[r].salary, 0);
  const today = s.jobs.filter((j) => dayOf(j.s) === d).sort((a, b) => a.s - b.s);
  const people = [];
  for (const r of D.ROLE_IDS) for (let i = 0; i < headcount(s, r); i++) {
    const mine = today.filter((j) => j.r === r && j.i === i);
    const nowJob = mine.find((j) => s.t >= j.s && s.t <= j.e);
    people.push(`<tr><td><b>${staffName(r, i)}</b></td><td>${D.ROLES[r].name}</td><td>${nowJob ? `<span class="pill warn">${esc(nowJob.lab)}</span>` : '<span class="pill mute">free</span>'}</td><td class="hint">${mine.map((j) => `${fmtT(j.s).split(' ')[1]} ${esc(j.lab)}`).join(' · ') || '–'}</td></tr>`);
  }
  return `<div class="ph"><h2>Staff</h2><span class="hint">Payroll ${n0(pay)} / month</span></div>
  <p class="lead">Every task takes time. When a role is full for the day, work waits until tomorrow: watch the workload bars. Hiring costs 2,000 and takes ${D.HIRE_LEAD_DAYS} days.</p>
  <div class="card"><div class="scroll"><table><tr><th>Role</th><th class="r">People</th><th class="r">Salary</th><th>Today's load</th><th></th></tr>${rows}</table></div></div>
  <div class="card"><h3>People and today's work</h3><div class="scroll"><table><tr><th>Name</th><th>Role</th><th>Now</th><th>Today</th></tr>${people.join('')}</table></div></div>
  <div class="card"><h3>Who does what</h3><table>
    <tr><td>Enter orders, set price</td><td>Sales Executive</td></tr>
    <tr><td>Release on credit warning</td><td>${s.controls.credit === 'warning' ? '<span class="k-bad">Sales Executive</span>' : 'Finance Manager only'}</td></tr>
    <tr><td>Edit credit limits</td><td>${s.controls.md === 'asis' ? '<span class="k-bad">Sales Executive</span>' : s.controls.md === 'makerchecker' ? 'Credit Analyst + FM' : 'Finance Manager'}</td></tr>
    <tr><td>Raise invoices</td><td>${s.controls.invoicing === 'auto' ? 'ERP (automatic)' : 'Billing Clerk'}</td></tr>
    <tr><td>Apply cash</td><td>${s.controls.roles === 'split' && headcount(s, 'CAO') ? 'Cash Application Officer' : '<span class="k-warn">Billing Clerk</span>'}</td></tr>
    <tr><td>Issue credit notes</td><td>${s.controls.roles === 'split' ? 'Finance Manager approves' : '<span class="k-bad">Billing Clerk, no approval</span>'}</td></tr></table></div>`;
}

// ---------- Reports ----------
export function reportsTab(s, final) {
  const rows = s.reports.slice().reverse().map((r) => `<tr data-report="${r.m}" style="cursor:pointer"><td><b>${r.monthName}</b></td><td class="r mono">${n0(r.booked)}</td><td class="r mono">${n0(r.correct)}</td><td class="r mono">${r.score}</td><td>${r.auditFail ? (r.auditWarning ? '<span class="pill warn">Warning</span>' : '<span class="pill bad">Strike</span>') : '<span class="pill good">Accepted</span>'}</td></tr>`).join('');
  return `<div class="ph"><h2>Month-end reports</h2></div>
  <p class="lead">Books close on the 3rd of the next month, after late invoices come in. Tap a month for the full report.</p>
  ${final ? `<div class="card"><h3>Campaign result: grade ${final.grade}</h3><p>Total ${final.total} = KPIs ${final.kpiPts} + profit ${final.profitPts} + cash ${final.cashPts}. Questions right: ${final.quiz}.</p><button class="btn" data-act="final">Open final report</button></div>` : ''}
  <div class="card"><div class="scroll"><table><tr><th>Month</th><th class="r">ERP revenue</th><th class="r">Earned</th><th class="r">Score</th><th>Auditors</th></tr>${rows || '<tr><td colspan="5">The first report arrives on 3 April.</td></tr>'}</table></div></div>`;
}

// ---------- Learn ----------
export function learnTab(s) {
  const ans = s.answers.slice().reverse().map((a) => { const q = questionById(s, a.id); if (!q) return ''; return `<tr data-q="${a.id}" style="cursor:pointer"><td>${fmtDay(a.day)}</td><td>${q.title}</td><td>${a.correct ? '<span class="pill good">Right</span>' : '<span class="pill bad">Missed</span>'}</td></tr>`; }).join('');
  const left = Object.keys(D.QUESTIONS).filter((id) => !s.asked[id]).length;
  return `<div class="ph"><h2>Finance desk</h2><span class="hint">${s.answers.filter((a) => a.correct).length} right of ${s.answers.length}</span></div>
  <p class="lead">At the end of each week you get a short review: about 5 questions about what really happened that week. Tap one to read the answer again. Key moments still to come: ${left}.</p>
  <div class="card"><h3>Your questions</h3>${ans ? `<table><tr><th>When</th><th>Question</th><th>Result</th></tr>${ans}</table>` : '<span class="hint">None yet. The first weekly review comes on 7 March.</span>'}</div>
  <div class="cards">${D.CONCEPTS.map((c) => `<div class="cc" style="--c:var(--${c.c})"><h3>${c.t}</h3><div>${c.d}</div><div class="f">${c.f}</div><div class="hint"><b>Here:</b> ${c.ex}</div></div>`).join('')}</div>`;
}

// ---------- Events ----------
export function eventsTab(s) {
  const rows = s.log.slice(-150).reverse().map((l) => `<div class="ev k-${l.kind}" ${l.order ? `data-order="${l.order}" style="cursor:pointer"` : ''}><time>${fmtT(l.t)}</time><span>${esc(l.text)}</span></div>`).join('');
  return `<div class="ph"><h2>Events</h2><span class="hint">Newest first · tap an order event to follow it</span></div><div class="feed">${rows}</div>`;
}

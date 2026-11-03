// All fixed game data: the Zenith case (Problem 1, Exhibits A-H), the control catalogue,
// staff, questions and concept cards. Case figures come from "Module 2 Problem 1 - Order to Cash".
// Anything not in the case is marked ASSUMPTION and is shown as such in the game.

export const PRODUCTS = {
  AC1: { name: '1.0 ton split AC', list: 1500, floor: 1350, cost: 1000 },
  AC2: { name: '1.5 ton split AC', list: 2000, floor: 1800, cost: 1300 },
  AC3: { name: '2.0 ton split AC', list: 2500, floor: 2250, cost: 1600 },
};
export const PRODUCT_IDS = ['AC1', 'AC2', 'AC3'];

// Exhibit B. Payment behaviour (pay*) is an ASSUMPTION based on how each dealer behaves in March.
export const DEALERS = {
  D1: { name: 'Al Noor Electronics', short: 'Al Noor', emirate: 'Dubai', limit: 60000, terms: 30,
        payMin: 18, payMax: 25, noRef: 0.05, weight: 30, qMin: 5, qMax: 20, color: '#2B8A3E' },
  D2: { name: 'Sky Home Appliances', short: 'Sky Home', emirate: 'Sharjah', limit: 40000, terms: 30,
        payMin: 45, payMax: 70, noRef: 0.1, weight: 20, qMin: 5, qMax: 12, color: '#E03131', risky: true },
  D3: { name: 'Coolmart Trading', short: 'Coolmart', emirate: 'Abu Dhabi', limit: 80000, terms: 45,
        payMin: 20, payMax: 40, noRef: 0.05, weight: 30, qMin: 8, qMax: 20, color: '#1971C2' },
  D4: { name: 'Gulf Comfort', short: 'Gulf Comfort', emirate: 'Ajman', limit: 30000, terms: 30,
        payMin: 25, payMax: 35, noRef: 0.6, weight: 20, qMin: 4, qMax: 12, color: '#E67700' },
};
export const DEALER_IDS = ['D1', 'D2', 'D3', 'D4'];

// Exhibit C (day index: 0 = 1 March 2025)
export const OPENING_INVOICES = [
  { id: 'INV-790', dealer: 'D2', day: -50, amount: 35000 },
  { id: 'INV-801', dealer: 'D1', day: -14, amount: 20000 },
];

// Exhibit D, with the "script" that reproduces exactly what happened in March when
// the related control is still set to "today". If you change a control, the script for
// that step is ignored and the normal rules apply.
export const MARCH_ORDERS = [
  { id: 'O-101', day: 1, hour: 9, dealer: 'D1', product: 'AC2', qty: 10, disc: 0, sePush: false,
    script: { invoiceDay: 2, pay: { day: 21, ref: true } } },
  { id: 'O-102', day: 3, hour: 10, dealer: 'D2', product: 'AC1', qty: 10, disc: 0, sePush: true,
    script: { invoiceDay: 4 } },
  { id: 'O-103', day: 5, hour: 9, dealer: 'D3', product: 'AC3', qty: 20, disc: 0.08, sePush: false,
    script: { approver: 'SM', invoiceDay: 6, pay: { day: 29, ref: true } } },
  { id: 'O-104', day: 9, hour: 11, dealer: 'D1', product: 'AC1', qty: 20, disc: 0.12, sePush: true,
    script: { approver: 'SE', invoiceDay: 10 } },
  { id: 'O-105', day: 13, hour: 10, dealer: 'D4', product: 'AC2', qty: 15, disc: 0.05, sePush: false,
    script: { approver: 'SE', invoiceDay: 14, pay: { day: 24, amount: 10000, ref: false } } },
  { id: 'O-106', day: 17, hour: 9, dealer: 'D3', product: 'AC2', qty: 25, disc: 0, sePush: false,
    script: { invoiceDay: 20 } },
  { id: 'O-107', day: 23, hour: 11, dealer: 'D2', product: 'AC3', qty: 8, disc: 0, sePush: false, script: {} },
  { id: 'O-108', day: 27, hour: 10, dealer: 'D4', product: 'AC1', qty: 10, disc: 0, sePush: true,
    requestedDay: 30, script: { invoiceDay: 32 } },
  { id: 'O-109', day: 29, hour: 12, dealer: 'D1', product: 'AC3', qty: 4, disc: 0, sePush: false,
    script: { invoiceMissed: true } },
];

// Exhibit G: receipts against the opening invoices (receipts for March invoices sit in order scripts)
export const MARCH_OPENING_RECEIPTS = [
  { day: 7, dealer: 'D1', amount: 20000, ref: 'INV-801' },
  { day: 15, dealer: 'D2', amount: 15000, ref: 'INV-790', part: true },
];
// Exhibit B change log
export const MARCH_MD_CHANGE = { day: 26, dealer: 'D4', from: 30000, to: 45000 };

// ASSUMPTION: opening stock is not in the case. Chosen so that DN-505 can only ship 12 AC2.
// The ERP thinks there are 25 AC2; 3 were damaged and never recorded.
export const OPENING_STOCK = {
  AC1: { sys: 70, real: 70 }, AC2: { sys: 25, real: 22 }, AC3: { sys: 45, real: 45 },
};
// ASSUMPTION: simple automatic replenishment (purchasing is out of scope of Problem 1)
export const REORDER = { AC1: { rop: 25, qty: 40 }, AC2: { rop: 20, qty: 40 }, AC3: { rop: 15, qty: 30 }, lead: 14 };

export const OPENING_CASH = 200000; // ASSUMPTION
export const RENT = 6000; // ASSUMPTION: rent and utilities per month

// Staff. Salaries are ASSUMPTIONS (AED per month).
export const ROLES = {
  SE: { name: 'Sales Executive', short: 'SE', salary: 5000, color: '#6741D9', base: 2 },
  SM: { name: 'Sales Manager', short: 'SM', salary: 7000, color: '#6741D9', base: 1 },
  GM: { name: 'General Manager', short: 'GM', salary: 10000, color: '#16203A', base: 1 },
  FM: { name: 'Finance Manager', short: 'FM', salary: 9000, color: '#C2255C', base: 1 },
  BC: { name: 'Billing Clerk', short: 'BC', salary: 4000, color: '#0B7285', base: 1 },
  CAO: { name: 'Cash Application Officer', short: 'CA', salary: 6000, color: '#2B8A3E', base: 0 },
  CR: { name: 'Credit Analyst', short: 'CR', salary: 7000, color: '#D9480F', base: 0 },
  WH: { name: 'Warehouse staff', short: 'WH', salary: 3000, color: '#566079', base: 2 },
  DR: { name: 'Driver', short: 'DR', salary: 3000, color: '#566079', base: 1 },
};
export const ROLE_IDS = ['SE', 'SM', 'GM', 'FM', 'BC', 'CAO', 'CR', 'WH', 'DR'];
export const HIRE_LEAD_DAYS = 14;
export const MAX_HEADCOUNT = { SE: 4, SM: 1, GM: 1, FM: 1, BC: 3, CAO: 2, CR: 2, WH: 4, DR: 3 };

// ---------- The 11 steps and their controls ----------
// stage: contribution to Exhibit H cycle time (days) and manual touches for the KPI.
export const STEPS = [
  { id: 'intake', num: 1, name: 'Order intake', color: 'ctrl', station: 'inbox',
    today: 'Dealers send orders to a Sales Executive by WhatsApp or phone. The Sales Executive re-types each order into the ERP.',
    policy: 'A complete, written order: dealer, product, quantity, price.',
    controls: [
      { key: 'intake', label: 'How orders come in', options: [
        { v: 'whatsapp', label: 'WhatsApp / phone, re-typed (today)', cost: 0, days: 0, monthly: 0,
          effect: 'About 4% of orders are typed with the wrong quantity and 2% of messages get lost for a day.' },
        { v: 'form', label: 'Standard order template with mandatory fields', cost: 2000, days: 3, monthly: 0,
          effect: 'Typing errors fall to 1%. No lost messages. Entry is faster.' },
        { v: 'portal', label: 'Dealer portal: dealers key in their own orders', cost: 25000, days: 28, monthly: 1500,
          effect: 'No re-typing at all. Orders reach the ERP instantly. Dealers like it (+satisfaction).' },
      ] },
      { key: 'volume', label: 'Order volume (% of normal demand)', type: 'slider', min: 50, max: 200, step: 10, free: true,
        effect: 'More orders = more revenue but more work for every role. Watch the queues.' },
    ] },
  { id: 'pricing', num: 2, name: 'Price and discount', color: 'price', station: 'sales',
    today: 'The Sales Executive enters the price and discount. Nobody checks who approved it.',
    policy: 'P2: discount up to 5% Sales Executive; above 5% up to 10% Sales Manager; above 10% General Manager and Finance Manager together.',
    controls: [
      { key: 'pricing', label: 'Discount approval', options: [
        { v: 'asis', label: 'Sales Executive decides; approval not enforced (today)', cost: 0, days: 0, monthly: 0,
          effect: 'About half of big discounts are approved by the Sales Executive alone.' },
        { v: 'p2', label: 'ERP workflow that enforces policy P2', cost: 8000, days: 14, monthly: 0,
          effect: 'Every discount goes to the right approver. Manager approvals add a few hours; GM + FM add a day.' },
        { v: 'custom', label: 'ERP workflow with my own thresholds', cost: 8000, days: 14, monthly: 0,
          effect: 'Set your own % bands below. Looser than P2 still counts as a policy breach in the KPIs.' },
      ] },
      { key: 'th1', label: 'Sales Executive may approve up to (%)', type: 'number', min: 0, max: 15, free: true, showIf: { pricing: 'custom' } },
      { key: 'th2', label: 'Sales Manager may approve up to (%)', type: 'number', min: 0, max: 20, free: true, showIf: { pricing: 'custom' } },
      { key: 'floorBlock', label: 'Block prices below the floor price', options: [
        { v: 'off', label: 'Off (today)', cost: 0, days: 0, monthly: 0, effect: 'Orders can be sold below floor price.' },
        { v: 'on', label: 'On: discounts are capped at 10%', cost: 1000, days: 7, monthly: 0, needs: { pricing: ['p2', 'custom'] },
          effect: 'No sale below floor. Some dealers are unhappy and a few cancel.' },
      ] },
    ] },
  { id: 'credit', num: 3, name: 'Credit check and release', color: 'credit', station: 'erp',
    today: 'The ERP shows a warning if a dealer is over its limit, but the Sales Executive can click "Release". The order is not stopped.',
    policy: 'P1: release only if exposure stays within the credit limit and the dealer has no overdue invoice. Only the Finance Manager may override, with a reason and an expiry.',
    controls: [
      { key: 'credit', label: 'What the ERP does when the credit test fails', options: [
        { v: 'warning', label: 'Warning only; Sales Executive can release (today)', cost: 0, days: 0, monthly: 0,
          effect: 'Pushy dealers get their goods. Some held orders wait 2 days for the Finance Manager.' },
        { v: 'hardstop', label: 'Hard stop: credit hold, only the Finance Manager can release', cost: 12000, days: 14, monthly: 0,
          effect: 'No release without the Finance Manager. Held orders wait about 1 day. More FM work; some dealers get annoyed.' },
        { v: 'hardstop_sla', label: 'Hard stop + 4-hour decision deadline + escalation to CFO', cost: 15000, days: 14, monthly: 0,
          effect: 'As hard stop, but decisions within 4 working hours. Dealers wait less.' },
      ] },
    ] },
  { id: 'md', num: 4, name: 'Customer master data', color: 'ctrl', station: 'erp',
    today: 'Sales Executives can edit customer details in the ERP, including credit limits.',
    policy: 'P5: credit limit changes must be approved by the Finance Manager. An unapproved change is invalid; the old limit still applies.',
    controls: [
      { key: 'md', label: 'Who can change a credit limit', options: [
        { v: 'asis', label: 'Sales Executives can edit limits (today)', cost: 0, days: 0, monthly: 0,
          effect: 'Sales can raise a limit to get an order through. The ERP then checks against the wrong limit.' },
        { v: 'fm_only', label: 'Remove Sales edit rights; Finance Manager approves requests', cost: 1000, days: 2, monthly: 0,
          effect: 'Sales can only request. FM decides. Cheap and quick.' },
        { v: 'makerchecker', label: 'Maker-checker: Credit Analyst enters, Finance Manager approves', cost: 6000, days: 14, monthly: 0, needs: { hire: 'CR' },
          effect: 'Full segregation. Needs a Credit Analyst. Takes FM work off credit admin.' },
      ] },
      { key: 'mdReport', label: 'Weekly change-log report', options: [
        { v: 'off', label: 'Off (today)', cost: 0, days: 0, monthly: 0, effect: 'Nobody looks at the change log.' },
        { v: 'on', label: 'On: FM reviews changes weekly and reverses unapproved ones', cost: 2000, days: 7, monthly: 0,
          effect: 'Detective control: catches unapproved changes within a week.' },
      ] },
    ] },
  { id: 'warehouse', num: 5, name: 'Pick, ship and stock', color: 'bill', station: 'warehouse',
    today: 'The warehouse picks and ships every released order. Shortages are not tracked; the ERP deducts the ordered quantity.',
    policy: 'Ship only approved orders. Record what really leaves the warehouse. Track any shortage as a back-order.',
    controls: [
      { key: 'shortage', label: 'When stock is short', options: [
        { v: 'untracked', label: 'Ship what we have, nobody records the gap (today)', cost: 0, days: 0, monthly: 0,
          effect: 'ERP stock goes wrong; dealer gets less than ordered and nobody tells billing.' },
        { v: 'backorder', label: 'Back-order register; ERP records the shipped quantity', cost: 5000, days: 14, monthly: 0,
          effect: 'The rest is shipped when stock arrives. Dealer is told the same day.' },
      ] },
      { key: 'count', label: 'Stock counting', options: [
        { v: 'none', label: 'No regular count (today)', cost: 0, days: 0, monthly: 0,
          effect: 'Real shelf stock is unknown, to you and to the business.' },
        { v: 'monthly', label: 'Full count at month end by an independent person', cost: 1500, days: 3, monthly: 800,
          effect: 'Real stock revealed once a month; ERP corrected.' },
        { v: 'weekly', label: 'Weekly cycle count', cost: 3000, days: 7, monthly: 1500,
          effect: 'Real stock revealed every week.' },
        { v: 'scan', label: 'Barcode scanning on every movement', cost: 30000, days: 28, monthly: 1000,
          effect: 'ERP stock = real stock, live. Losses are recorded the moment they happen.' },
      ] },
    ] },
  { id: 'pod', num: 6, name: 'Proof of delivery', color: 'bill', station: 'truck',
    today: 'The driver brings back the paper signed delivery note one to three days later.',
    policy: 'P3: the signed delivery note is the basis for invoicing.',
    controls: [
      { key: 'pod', label: 'How the signed delivery note gets back', options: [
        { v: 'paper', label: 'Paper note, returned by the driver (today)', cost: 0, days: 0, monthly: 0,
          effect: 'Billing sees the real quantity 1-3 days after delivery.' },
        { v: 'scan', label: 'Driver photographs the signed note at the door', cost: 8000, days: 14, monthly: 0,
          effect: 'Same-day quantity for billing.' },
        { v: 'epod', label: 'e-POD: dealer e-signs on a tablet; quantity posts to ERP', cost: 20000, days: 28, monthly: 800,
          effect: 'Same-day, no paper. Needed for automatic invoicing.' },
      ] },
    ] },
  { id: 'invoicing', num: 7, name: 'Invoicing', color: 'bill', station: 'billing',
    today: 'The Billing Clerk raises invoices in batches every few days, copying the quantity from the sales order.',
    policy: 'P3: invoice the quantity actually delivered, at the price on the approved order.',
    controls: [
      { key: 'invoicing', label: 'How invoices are raised', options: [
        { v: 'asis', label: 'Batch every 3 days, quantity copied from the order (today)', cost: 0, days: 0, monthly: 0,
          effect: 'Over-bills short deliveries. About 8% of deliveries are forgotten.' },
        { v: 'fromDN', label: 'Batch every 3 days, quantity from the signed delivery note', cost: 0, days: 2, monthly: 0,
          effect: 'Right quantity. Still slow; about 3% forgotten. Must wait for the paper note.' },
        { v: 'daily', label: 'Daily run from the delivery note', cost: 3000, days: 7, monthly: 0,
          effect: 'Right quantity, faster; about 1% forgotten.' },
        { v: 'auto', label: 'Automatic invoice from e-POD, dated the delivery day', cost: 15000, days: 28, monthly: 0, needs: { pod: ['epod'] },
          effect: 'Nothing forgotten, right quantity, right date. No clerk time.' },
      ] },
    ] },
  { id: 'cutoff', num: 8, name: 'Month-end cut-off', color: 'rev', station: 'fm',
    today: 'March is closed on 31 March. Invoices dated in early April are not checked against March deliveries.',
    policy: 'P4: revenue belongs to the month in which goods are delivered, whatever the invoice date.',
    controls: [
      { key: 'cutoff', label: 'Cut-off checklist on the last day', options: [
        { v: 'none', label: 'No check (today)', cost: 0, days: 0, monthly: 0,
          effect: 'Late or missing invoices push revenue into the wrong month.' },
        { v: 'checklist', label: 'FM runs "delivered not invoiced" and "invoiced not delivered"', cost: 0, days: 1, monthly: 0,
          effect: 'Missing invoices are raised in the right month; over-billing is credited before close. 3 hours of FM time.' },
      ] },
      { key: 'dni', label: 'Weekly "delivered not invoiced" report', options: [
        { v: 'off', label: 'Off (today)', cost: 0, days: 0, monthly: 0, effect: 'Forgotten invoices stay forgotten.' },
        { v: 'on', label: 'On', cost: 2000, days: 7, monthly: 0, effect: 'Forgotten invoices are found within a week.' },
      ] },
    ] },
  { id: 'cashapp', num: 9, name: 'Payment and cash application', color: 'cash', station: 'cash',
    today: 'The Billing Clerk records payments from the bank statement. Payments without an invoice reference go on a suspense list reviewed "when there is time".',
    policy: 'Every receipt matched to the right invoice promptly.',
    controls: [
      { key: 'cashapp', label: 'Matching receipts to invoices', options: [
        { v: 'asis', label: 'Clerk matches; suspense reviewed when there is time (today)', cost: 0, days: 0, monthly: 0,
          effect: 'Unreferenced cash can sit on suspense for weeks. Dealer balances look wrong.' },
        { v: 'daily', label: 'Daily suspense review, match by bank name and amount', cost: 0, days: 2, monthly: 0,
          effect: 'Most suspense items cleared next day. 1 hour of clerk time daily.' },
        { v: 'auto', label: 'ERP auto-matching; a person handles exceptions', cost: 18000, days: 28, monthly: 0,
          effect: 'Same-day matching, almost no manual work.' },
      ] },
      { key: 'askRefs', label: 'Ask dealers to quote invoice numbers', options: [
        { v: 'off', label: 'Off (today)', cost: 0, days: 0, monthly: 0, effect: 'Gulf Comfort usually pays without a reference.' },
        { v: 'on', label: 'On: letter to all dealers + reminder on every invoice', cost: 500, days: 3, monthly: 0,
          effect: 'Far fewer unreferenced payments.' },
      ] },
    ] },
  { id: 'monitoring', num: 10, name: 'Monitoring and reporting', color: 'rev', station: 'fm',
    today: 'The Finance Manager looks at the receivables ageing report once a month.',
    policy: 'Act on overdue dealers quickly; keep held orders held; review exceptions.',
    controls: [
      { key: 'monitoring', label: 'Review rhythm', options: [
        { v: 'monthly', label: 'Monthly ageing review (today)', cost: 0, days: 0, monthly: 0,
          effect: 'Late payers are chased once a month. Disputes take about 15 days.' },
        { v: 'weekly', label: 'Weekly ageing + reminders', cost: 0, days: 1, monthly: 0,
          effect: 'Late payers chased every week. Disputes about 7 days. 2 hours FM time a week.' },
        { v: 'dashboard', label: 'Weekly exception dashboard + monthly KPI pack', cost: 10000, days: 21, monthly: 0,
          effect: 'As weekly, plus disputes solved in about 3 days.' },
      ] },
    ] },
  { id: 'roles', num: 11, name: 'Roles and duties', color: 'ctrl', station: 'billing',
    today: 'The Billing Clerk invoices, records cash and issues credit notes. Sales Executives approve their own releases and edit customer data.',
    policy: 'No one person controls a whole transaction (segregation of duties).',
    controls: [
      { key: 'roles', label: 'Who does what in billing and cash', options: [
        { v: 'asis', label: 'One clerk does everything (today)', cost: 0, days: 0, monthly: 0,
          effect: 'Credit notes need no approval. Small unapproved write-offs happen and nobody notices.' },
        { v: 'split', label: 'Cash goes to a Cash Application Officer; FM approves credit notes', cost: 0, days: 7, monthly: 0, needs: { hire: 'CAO' },
          effect: 'No hidden write-offs. Needs a Cash Application Officer.' },
      ] },
    ] },
];

export const DEFAULT_CONTROLS = {
  intake: 'whatsapp', volume: 100, pricing: 'asis', th1: 5, th2: 10, floorBlock: 'off', credit: 'warning',
  md: 'asis', mdReport: 'off', shortage: 'untracked', count: 'none', pod: 'paper', invoicing: 'asis',
  cutoff: 'none', dni: 'off', cashapp: 'asis', askRefs: 'off', monitoring: 'monthly', roles: 'asis',
};

// Exhibit H stages, and what each setting does to days and touches (to-be design from sheet 7)
export function stageTable(c) {
  const autoCheck = c.pricing !== 'asis' && c.credit !== 'warning';
  return [
    { step: 'Order received → typed into ERP', days: c.intake === 'whatsapp' ? 1 : 0, touches: c.intake === 'portal' ? 0 : 1 },
    { step: 'Price, discount and credit check', days: 0, touches: autoCheck ? 0 : 1 },
    { step: 'Pick and ship', days: 1, touches: 2 },
    { step: 'Signed delivery note returned', days: c.pod === 'paper' ? 2 : 0, touches: 1 },
    { step: 'Invoice raised', days: c.invoicing === 'auto' ? 0 : c.invoicing === 'daily' ? 1 : 3,
      touches: c.invoicing === 'auto' ? 0 : c.invoicing === 'daily' ? 1 : 2 },
    { step: 'Payment received → cash applied', days: c.cashapp === 'auto' ? 1 : c.cashapp === 'daily' ? 2 : 4,
      touches: c.cashapp === 'auto' ? 1 : c.cashapp === 'daily' ? 1 : 2 },
  ];
}

// KPI list (sheet 8). dir: 'down' = lower is better.
export const KPIS = [
  { id: 'creditBreach', name: 'Released orders that broke the credit rule', fmt: 'pct', base: 0.25, target: 0, dir: 'down' },
  { id: 'overrideDocs', name: 'Overrides with reason and expiry on file', fmt: 'pct', base: 1, target: 1, dir: 'up' },
  { id: 'discountOk', name: 'Discounts approved at the right level', fmt: 'pct', base: 2 / 3, target: 1, dir: 'up' },
  { id: 'mdChanges', name: 'Unauthorised master-data changes', fmt: 'int', base: 1, target: 0, dir: 'down' },
  { id: 'rightFirst', name: 'Invoices right first time', fmt: 'pct', base: 0.625, target: 0.98, dir: 'up' },
  { id: 'dni', name: 'Delivered but not invoiced at month end (AED)', fmt: 'aed', base: 10000, target: 0, dir: 'down' },
  { id: 'unapplied', name: 'Unapplied receipts (% of receipts)', fmt: 'pct', base: 0.09, target: 0.01, dir: 'down' },
  { id: 'overdue', name: 'Overdue receivables (% of balance)', fmt: 'pct', base: 0.154, target: 0.05, dir: 'down' },
  { id: 'cycle', name: 'Order-to-cash time (days)', fmt: 'num', base: 11, target: 5, dir: 'down' },
  { id: 'touches', name: 'Manual touches per order', fmt: 'num', base: 9, target: 5, dir: 'down' },
  { id: 'exceptions', name: 'Orders with at least one policy exception', fmt: 'pct', base: 0.556, target: 0.05, dir: 'down' },
];

// ---------- Hotel project (ASSUMPTION, scaled version of the 100M / 60M / 20M question) ----------
export const PROJECT = {
  name: 'Al Bahar Hotel', units: 100, product: 'AC3', price: 2500, unitCost: 1500, advancePct: 0.2,
  signDay: 33, advanceDay: 37, deliveries: [{ day: 55, units: 40 }, { day: 80, units: 30 }, { day: 107, units: 30 }],
  payAfter: 30,
};

// ---------- Questions: "when is money counted?" ----------
// Each fires once, pauses the game, then explains with the live numbers.
export const QUESTIONS = {
  first_order: {
    title: 'An order just arrived', concept: 'promise',
    q: 'Al Noor (D1) sent order O-101 on WhatsApp: 10 × AC2 at 2,000 = 20,000. What does Zenith record in its accounts right now?',
    options: ['Revenue of 20,000', 'A receivable of 20,000', 'Nothing in the accounts yet: an order is only a promise', 'Cash of 20,000'],
    answer: 2,
    explain: 'An order is a promise from both sides. Nothing has been delivered and no money has moved, so the accounts do not change. The ERP only <b>reserves</b> the stock. Revenue comes when the goods are delivered; cash comes when the dealer pays.' },
  first_delivery: {
    title: 'Goods delivered', concept: 'delivery',
    q: 'DN-501 is signed: 10 × AC2 delivered to Al Noor at 2,000 each. Each unit cost Zenith 1,300. What is now true in the books?',
    options: ['Nothing until the invoice is sent', 'Revenue 20,000 and a receivable of 20,000; stock down and cost of goods 13,000', 'Cash 20,000', 'Revenue only when Al Noor pays'],
    answer: 1,
    explain: 'Delivery passes control of the goods to the dealer (P4, IFRS 15). That is the moment revenue is <b>earned</b>: revenue +20,000, receivable +20,000, stock −13,000 and cost of goods +13,000. Profit on this order = 7,000. No cash has arrived yet.' },
  first_invoice: {
    title: 'An invoice is raised', concept: 'invoice',
    q: 'The Billing Clerk raises an invoice for a delivery made earlier. What does the invoice itself change?',
    options: ['It creates the revenue', 'It is a request for payment: it documents the receivable and starts the payment clock (due date)', 'It puts cash in the bank', 'It moves stock out of the warehouse'],
    answer: 1,
    explain: 'The invoice is a <b>document</b>. It tells the dealer how much to pay and by when (due date = invoice date + terms, P6). Revenue was already earned at delivery. A late invoice does not move revenue into a later month, and a wrong invoice does not change what was really earned.' },
  first_receipt: {
    title: 'Money arrives in the bank', concept: 'cash',
    q: 'Al Noor pays 20,000 into Zenith\'s bank, quoting INV-801 (a February invoice). What changes?',
    options: ['Revenue +20,000', 'Cash +20,000 and Al Noor\'s receivable −20,000 once it is applied to INV-801', 'Nothing until month end', 'A new sale is recorded'],
    answer: 1,
    explain: 'Cash is counted when it <b>reaches Zenith\'s bank</b>, not when it is promised. Revenue does not change: it was counted in February when the goods were delivered. The payment just swaps one asset (receivable) for another (cash).' },
  part_payment: {
    title: 'A part payment', concept: 'overdue',
    q: 'Sky Home (D2) pays 15,000 marked "part payment INV-790". INV-790 was 35,000 and due on 9 February. Is Sky Home still overdue?',
    options: ['No, it has paid', 'Yes: 20,000 is still unpaid and past its due date', 'Only if it misses next month', 'Overdue is only checked at year end'],
    answer: 1,
    explain: 'A part payment reduces the debt but does not cure it. 35,000 − 15,000 = <b>20,000 still overdue</b>. Under P1 any overdue amount means new orders must be held.' },
  over_billing: {
    title: 'Billed more than delivered', concept: 'pod',
    q: 'INV-905 bills Gulf Comfort for 15 × AC2 at 1,900 = 28,500. The signed note DN-505 shows only 12 delivered. How much revenue has Zenith really earned?',
    options: ['28,500, the invoice amount', '22,800: 12 delivered × 1,900', 'Nothing until they pay', '5,700'],
    answer: 1,
    explain: 'Revenue follows what was <b>delivered</b>: 12 × 1,900 = 22,800. The invoice is 5,700 too high. The dealer will dispute it and a credit note is needed. Until then the books overstate revenue and receivables by 5,700.' },
  promise: {
    title: 'A promise to pay', concept: 'promise',
    q: 'Sky Home calls: "Release O-107 (20,000). We promise to pay the overdue 20,000 next week." Can Zenith count the promise, or release on it?',
    options: ['Yes, a promise is as good as cash', 'No. A promise is not cash or revenue; P1 says hold. Only the Finance Manager may override with a reason and expiry', 'Book the 20,000 as cash now', 'Release it and book revenue today'],
    answer: 1,
    explain: 'Nothing is counted on a promise. Cash counts when it reaches the bank; revenue counts on delivery. Sky Home already owes 35,000 (20,000 overdue), so exposure would be 55,000 against a 40,000 limit. The order stays held unless the Finance Manager formally overrides.' },
  suspense: {
    title: 'Money without a reference', concept: 'cashapp',
    q: '10,000 arrives from "Gulf Comfort" with no invoice reference and is put on the suspense list. Is the cash counted? What does the ERP show Gulf Comfort owing?',
    options: ['Not counted until matched', 'Cash is counted (+10,000 in the bank), but the ERP still shows Gulf Comfort owing the full balance until the receipt is applied', 'Counted as revenue', 'The receipt is returned'],
    answer: 1,
    explain: 'The bank has the money, so <b>cash is counted</b>. But until someone matches it to an invoice, the dealer\'s balance in the ERP is 10,000 too high. That can trigger wrong credit decisions and wrong collection calls.' },
  cutoff: {
    title: 'Which month?', concept: 'cutoff',
    q: 'O-108 was delivered on 31 March. Billing will date the invoice 2 April. Which month does the 15,000 of revenue belong to?',
    options: ['April, the invoice date', 'March, the delivery month', 'Whenever the dealer pays', 'Split half and half'],
    answer: 1,
    explain: 'P4: revenue belongs to the month of <b>delivery</b>, whatever the invoice date. If nobody checks, March is understated by 15,000 and April overstated by 15,000. A cut-off checklist on the last day prevents this.' },
  month_close: {
    title: 'Closing the month', concept: 'cutoff',
    q: 'The books for the month are closed. The ERP shows the revenue booked from invoices. Which number is the correct revenue for the month?',
    options: ['The ERP number: invoices dated in the month', 'The value of goods delivered in the month at the approved price', 'Cash received in the month', 'Orders received in the month'],
    answer: 1,
    explain: 'Correct revenue = value delivered in the month. Invoices can be late, missing or wrong; cash comes later; orders are only promises. The month-end report shows the gap between the two.' },
  credit_note: {
    title: 'A credit note', concept: 'creditnote',
    q: 'A credit note is issued to correct an over-billed invoice from an earlier month. What does it do?',
    options: ['Gives the dealer cash back', 'Reduces the invoice and the receivable; in the ERP it reduces revenue in the month it is issued', 'Increases revenue', 'Nothing, it is only a letter'],
    answer: 1,
    explain: 'A credit note cancels part of an invoice: the receivable falls and the ERP reduces revenue in the month it is posted. The real (delivered) revenue never included the over-billed amount, so the correct books do not change.' },
  project_signed: {
    title: 'A big contract', concept: 'advance',
    q: 'Al Bahar Hotel signs a contract: 100 × AC3 at 2,500 = 250,000, delivered over April-June. The units will cost Zenith 150,000. On signing day, what is Zenith\'s revenue from this contract?',
    options: ['250,000', '100,000 profit', 'Zero: nothing is delivered yet', '50,000'],
    answer: 2,
    explain: 'Signing is a promise. No goods have been delivered, so revenue is <b>zero</b>. (Same logic as a 100M project: a signed 100M contract is 0 revenue on day one.)' },
  project_advance: {
    title: 'The advance arrives', concept: 'advance',
    q: 'Al Bahar pays a 20% advance: 50,000 lands in Zenith\'s bank before anything is delivered. Where does it go in the books?',
    options: ['Revenue 50,000', 'Cash +50,000 and a liability of 50,000 (contract liability: we owe the goods)', 'Profit 50,000', 'Nowhere until delivery'],
    answer: 1,
    explain: 'The cash is real, so cash +50,000. But Zenith has not earned it yet: it owes the hotel goods. So it is a <b>liability</b> (contract liability / advance from customer), released as units are delivered. In a 100M project with a 20M advance, the 20M sits as a liability the same way.' },
  project_delivery: {
    title: 'First project delivery', concept: 'advance',
    q: '40 units are delivered to Al Bahar (40 × 2,500 = 100,000; cost 40 × 1,500 = 60,000). 20% of the invoice is taken from the advance. What are revenue, cost, profit and the advance left?',
    options: ['Revenue 100,000, cost 60,000, profit 40,000; advance left 30,000; receivable 80,000', 'Revenue 80,000, cost 60,000, profit 20,000', 'Revenue 150,000 (with the advance)', 'Revenue 0 until the hotel pays'],
    answer: 0,
    explain: 'Revenue = delivered value 100,000. Cost = 60,000, so profit 40,000. 20,000 of the advance is used (liability 50,000 → 30,000), and the hotel owes the other 80,000 (receivable). Cash comes when it pays.' },
  project_end: {
    title: 'The project is finished', concept: 'advance',
    q: 'All 100 units are delivered. Across the whole contract, what are revenue, cost, profit and the advance liability left?',
    options: ['Revenue 250,000, cost 150,000, profit 100,000, liability 0', 'Revenue 300,000', 'Profit 250,000', 'Liability 50,000'],
    answer: 0,
    explain: 'Revenue 250,000 was recognised delivery by delivery (100,000 + 75,000 + 75,000). Cost 150,000, profit 100,000. The 50,000 advance was fully used, so the liability is 0. The 100M project works the same: 100M revenue, 60M material cost (plus other costs), 20M advance released as work is delivered.' },
  bad_debt: {
    title: 'A dealer cannot pay', concept: 'baddebt',
    q: 'Sky Home has gone out of business owing money. What happens to the receivable?',
    options: ['Nothing, keep it in the books', 'It is written off: receivable gone and a bad-debt expense hits profit', 'Revenue is reversed for every past sale', 'Cash goes down'],
    answer: 1,
    explain: 'The revenue was earned, but the cash will never come. The receivable is written off as a <b>bad-debt expense</b>, which reduces profit. This is exactly what credit control (P1) exists to prevent.' },
  revenue_rule: {
    title: 'How is revenue recognised?', concept: 'delivery',
    q: 'In one sentence: when does a company like Zenith recognise revenue?',
    options: ['When the order is signed', 'When control of the goods passes to the customer (delivery), at the agreed price', 'When the invoice is sent', 'When the cash arrives'],
    answer: 1,
    explain: 'IFRS 15: revenue is recognised when (or as) the company satisfies its promise by transferring control of the goods or service. For Zenith that is <b>delivery</b>. For a project company it is <b>as the work is done</b> (often measured by progress).' },
};

// ---------- Concept cards (from the solution page, plus money-timing cards) ----------
export const CONCEPTS = [
  { id: 'promise', c: 'rev', t: 'An order is a promise', d: 'Orders and promises to pay change nothing in the accounts. They only reserve stock and create an expectation.', f: 'Order = 0 in the books. Promise to pay = 0 in the books.', ex: 'O-101 arrives: nothing booked. D2 promises to pay: nothing counted.' },
  { id: 'delivery', c: 'rev', t: 'Revenue is earned on delivery', d: 'When the signed delivery note shows the goods reached the dealer, control has passed. Revenue, receivable and cost of goods are recorded.', f: 'Revenue = delivered qty × approved price. COGS = delivered qty × unit cost.', ex: 'DN-501: revenue 20,000, COGS 13,000, profit 7,000.' },
  { id: 'invoice', c: 'bill', t: 'The invoice is a document', d: 'The invoice asks for payment and starts the due-date clock. It does not create revenue and does not move it to another month.', f: 'Due date = invoice date + payment terms (P6).', ex: 'INV-907 dated 2-Apr for a 31-Mar delivery: still March revenue.' },
  { id: 'cash', c: 'cash', t: 'Cash counts when it reaches the bank', d: 'Cash is counted when the money is in Zenith\'s bank account. Applying it to an invoice then clears the receivable.', f: 'Cash +; receivable − when applied. Revenue unchanged.', ex: 'R-1: 20,000 from Al Noor clears INV-801.' },
  { id: 'advance', c: 'cash', t: 'Advance = contract liability', d: 'Money received before delivery is owed back as goods. It is a liability, released into revenue as delivery happens.', f: 'Advance: cash +, liability +. On delivery: liability −, revenue +.', ex: 'Al Bahar 50,000 advance, released 20% per delivery.' },
  { id: 'creditnote', c: 'bill', t: 'Credit note', d: 'Cancels all or part of an invoice. Reduces the receivable and (in the ERP) revenue in the month posted.', f: 'Credit note = over-billed qty × price.', ex: 'INV-905: 3 units × 1,900 = 5,700.' },
  { id: 'baddebt', c: 'credit', t: 'Bad debt', d: 'Revenue earned but never collected. The receivable is written off as an expense.', f: 'Write-off: receivable −, bad-debt expense +.', ex: 'A dealer that goes bankrupt while owing money.' },
  { id: 'exposure', c: 'credit', t: 'Credit exposure', d: 'What the dealer would owe if we ship this order: balance before the order + the order value.', f: 'Exposure = balance before + order value. Hold if exposure > approved limit.', ex: 'O-102: 35,000 + 15,000 = 50,000 vs 40,000.' },
  { id: 'overdue', c: 'credit', t: 'Overdue and due date', d: 'The part of the balance past its due date. A dealer with any overdue invoice should not get new goods without approval.', f: 'Due date = invoice date + terms. Overdue = unpaid amount past that date.', ex: 'D2 INV-790: due 9-Feb, 50 days late at 31-Mar.' },
  { id: 'limit', c: 'credit', t: 'Approved limit vs ERP limit', d: 'The ERP limit is only valid if the Finance Manager approved it.', f: 'Test against the approved limit, not the number in the ERP.', ex: 'D4: 30,000 approved, 45,000 in the ERP.' },
  { id: 'hardstop', c: 'ctrl', t: 'Hard stop vs warning', d: 'A warning can be ignored. A hard stop blocks the action until the right person approves.', f: 'Preventive controls should be hard stops.', ex: 'O-102: warning shown, Sales Executive clicked Release.' },
  { id: 'doa', c: 'price', t: 'Delegation of authority', d: 'Who may approve what, by size. Bigger discount = more senior approver.', f: 'Required approver by %, compare with actual approver.', ex: 'O-104: 12% needs GM + FM; approved by a Sales Executive.' },
  { id: 'floor', c: 'price', t: 'Floor price', d: 'The lowest price the company accepts.', f: 'Below floor = (floor − sold price) × qty.', ex: 'O-104: (1,350 − 1,320) × 20 = 600.' },
  { id: 'pod', c: 'bill', t: 'Invoice from proof of delivery', d: 'Invoice the quantity on the signed delivery note, not the order.', f: 'Should invoice = delivered qty × approved price.', ex: 'O-105: 12 delivered, 15 billed.' },
  { id: 'cutoff', c: 'rev', t: 'Revenue cut-off', d: 'Revenue belongs to the period of delivery, not the invoice or cash date.', f: 'Gap = correct (delivered) − booked (invoiced).', ex: 'March: booked 185,900, correct 205,200.' },
  { id: 'ar', c: 'cash', t: 'Receivables and ageing', d: 'Money dealers owe us, split by how late each invoice is.', f: 'Closing = opening + invoiced − received.', ex: '55,000 + 185,900 − 111,000 = 129,900.' },
  { id: 'cashapp', c: 'cash', t: 'Cash application and suspense', d: 'Every receipt must be matched to an invoice. Unreferenced receipts wait on suspense.', f: 'Match by reference, then bank name and amount.', ex: 'R-4: 10,000 from Gulf Comfort, no reference.' },
  { id: 'makerchecker', c: 'ctrl', t: 'Maker-checker', d: 'One person proposes a change, another approves it.', f: 'No change takes effect until the checker approves.', ex: 'D4 limit 30,000 → 45,000 with no approval.' },
  { id: 'sod', c: 'ctrl', t: 'Segregation of duties', d: 'No single person should start, approve and hide a transaction.', f: 'Different people: invoice, receive cash, issue credit notes.', ex: 'The Billing Clerk did all three.' },
  { id: 'controltypes', c: 'ctrl', t: 'Preventive, detective, corrective', d: 'Preventive stops the error, detective finds it fast, corrective fixes it.', f: 'At least one preventive control per risk, backed by a detective one.', ex: 'Hard stop / weekly ageing / credit note.' },
  { id: 'cycle', c: 'ctrl', t: 'Cycle time and touches', d: 'Days from order to cash applied, and how many times a person handles it.', f: 'Sum of step days; sum of manual touches.', ex: 'Today 11 days, 9 touches; design 2 days, 5 touches.' },
  { id: 'kpi', c: 'rev', t: 'KPI: baseline, target, owner', d: 'A measure with today\'s value, a goal, an owner and a rhythm.', f: 'Baseline from data; target; owner; frequency.', ex: 'Credit breaches 25% → 0%.' },
];

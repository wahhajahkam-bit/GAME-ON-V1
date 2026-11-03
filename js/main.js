// Game loop, input and screen updates.
import * as D from './data.js?v=6';
import { createGame, advanceTo, skipToNextClose, setControl, hire, letGo, answerQuestion, setApprovedLimit } from './sim/sim.js?v=6';
import { DAY_START, DAY_END, tOf, dayOf, fmtDayLong, fmtClock, fmtDay, fmtT } from './sim/time.js?v=6';
import { finalScore } from './sim/report.js?v=6';
import { questionById } from './sim/weekly.js?v=6';
import { draw, readColors, hitTest, W, H, ZONES, staffName } from './render/map.js?v=6';
import * as P from './ui/panels.js?v=6';
import * as M from './ui/modals.js?v=6';

const SAVE_KEY = 'zenith-o2c-save-v1';
const VERSION = 'v6';
const SPEEDS = [0, 2, 4, 10, 20]; // game minutes per real second: pause, 1× (a 10-hour day = 5 min), 2×, 5×, 10× (30 s)
const $ = (s) => document.querySelector(s);

let s = null;
let speed = 0;
let ui = { tab: 'steps', openStep: null, hover: null, hoverOrder: null, hoverStaff: null, orderFilter: 'month', modal: null };
const settings = { sound: false, theme: '', drawer: 'half', pw: 520, ph: 55, feed: true };
let savedSettings = {};
try { savedSettings = JSON.parse(localStorage.getItem('zenith-o2c-settings') || '{}'); Object.assign(settings, savedSettings); } catch (e) { /* storage blocked */ }
if (!savedSettings.drawer && window.innerWidth <= 760) settings.drawer = 'closed'; // phones start with the map
const saveSettings = () => { try { localStorage.setItem('zenith-o2c-settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } };
applyTheme();

const canvas = $('#map');
const ctx = canvas.getContext('2d');

// ---------- canvas sizing: fill the map area, keep the 1000 × 620 shape ----------
const layout = $('#layout');
const wrap = $('#canvasWrap');
function resize() {
  const aw = wrap.clientWidth - 2, ah = wrap.clientHeight - 2;
  if (aw <= 0 || ah <= 0) return;
  let w = Math.min(aw, ah * W / H);
  const minW = window.innerWidth <= 760 ? 760 : 560; // below this the text is too small: the frame scrolls instead
  if (w < minW) w = minW;
  const h = w * H / W;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  wrap.style.placeItems = w > aw || h > ah ? 'start' : 'center';
}
new ResizeObserver(() => resize()).observe(wrap);
window.addEventListener('resize', () => { document.documentElement.style.setProperty('--hudh', $('#hud').offsetHeight + 'px'); setPanelWidth(settings.pw, true); });

// ---------- the side panel (drawer): closed / half / full, resizable ----------
function setPanel(state) {
  settings.drawer = state; saveSettings();
  layout.dataset.drawer = state;
  document.querySelectorAll('.pc').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.panel === state)));
  document.documentElement.style.setProperty('--hudh', $('#hud').offsetHeight + 'px');
  if (state !== 'closed' && s) render(true);
}
function setPanelWidth(px, quiet) {
  const max = Math.max(320, layout.clientWidth - 240);
  settings.pw = Math.round(Math.max(300, Math.min(max, px)));
  layout.style.setProperty('--pw', settings.pw + 'px');
  if (!quiet) saveSettings();
}
function setPanelHeight(pct) {
  settings.ph = Math.round(Math.max(25, Math.min(90, pct)));
  layout.style.setProperty('--ph', settings.ph + 'dvh'); saveSettings();
}
(function initDrawer() {
  setPanelWidth(settings.pw, true); setPanelHeight(settings.ph); setPanel(settings.drawer || 'half');
  const rz = $('#resizer');
  let dragging = false;
  rz.addEventListener('pointerdown', (e) => { dragging = true; rz.classList.add('drag'); rz.setPointerCapture(e.pointerId); e.preventDefault(); });
  rz.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (window.innerWidth <= 760) setPanelHeight((window.innerHeight - e.clientY) / window.innerHeight * 100);
    else setPanelWidth(layout.getBoundingClientRect().right - e.clientX - 8);
  });
  const end = () => { if (dragging) { dragging = false; rz.classList.remove('drag'); saveSettings(); } };
  rz.addEventListener('pointerup', end); rz.addEventListener('pointercancel', end);
  rz.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') setPanelWidth(settings.pw + 40);
    if (e.key === 'ArrowRight') setPanelWidth(settings.pw - 40);
  });
})();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); });

// ---------- start ----------
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function newGame(mode, questions) {
  s = createGame({ mode, seed: (Date.now() % 1000000) | 0, questions });
  speed = 0; ui.tab = 'steps'; ui.openStep = null; lastLogLen = 0;
  dock.key = null; dock.mode = 'pill'; $('#qdock').innerHTML = '';
  closeModal(); buildTabs(); render(true);
  toast(mode === 'campaign' ? 'Campaign started. Press 1× to run the business, or open a step first.' : 'Sandbox started.');
}
function saveGame(silent) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); if (!silent) toast('Game saved in this browser.'); }
  catch (e) { if (!silent) toast('Could not save (browser storage is blocked or full).'); }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { toast('No saved game found.'); return false; }
    s = JSON.parse(raw); speed = 0; lastLogLen = s.log.length;
    s.qPending = s.qPending || s.qQueue || []; delete s.qQueue; s.dynQ = s.dynQ || {}; s.weekReview = s.weekReview || null; dock.key = null; $('#qdock').innerHTML = ''; closeModal(); buildTabs(); render(true); toast('Game loaded.');
    return true;
  } catch (e) { toast('Could not load the saved game.'); return false; }
}

// ---------- loop ----------
let last = performance.now();
let panelTimer = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (s && !s.over && speed && !ui.modal) {
    tick(dt * SPEEDS[speed]);
    afterAdvance();
  }
  if (s) {
    draw(ctx, s, ui);
    panelTimer += dt;
    if (panelTimer > (speed ? 0.6 : 1.5)) { panelTimer = 0; render(false); }
  }
  requestAnimationFrame(frame);
}
function tick(minutes) {
  const dayEnd = tOf(dayOf(s.t), DAY_END);
  const target = s.t + minutes;
  if (target >= dayEnd) { advanceTo(s, dayEnd); if (!s.over) advanceTo(s, tOf(dayOf(dayEnd) + 1, DAY_START)); }
  else advanceTo(s, target);
}
function afterAdvance() {
  sounds();
  if (s.newReport != null) {
    const m = s.newReport; s.newReport = null;
    saveGame(true);
    // no pause: the report waits as a notification on the map
    if (!s.over) { dock.report = m; drawDock(); }
  }
  if (s.over) { setSpeed(0); saveGame(true); openModal(M.finalModal(s), 'final'); return; }
  updateDock();
}

// ---------- rendering ----------
let lastLogLen = 0;
function render(force) {
  if (!s) return;
  $('#dateLabel').textContent = fmtDayLong(dayOf(s.t));
  $('#timeLabel').textContent = fmtClock(s.t) + (speed ? '' : ' · paused');
  const cash = $('#cashLabel'); cash.textContent = P.n0(s.cash); cash.classList.toggle('neg', s.cash < 0);
  $('#strikeLabel').textContent = s.mode === 'campaign' ? `${s.strikes} / 2` : '—';
  $('#modeLabel').textContent = (s.mode === 'campaign' ? 'Campaign: March to June' : 'Sandbox') + ' · ' + VERSION;
  $('#pausedTag').hidden = true;
  document.body.classList.toggle('isPaused', !speed && !s.over);
  document.querySelectorAll('.sp').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.speed === speed)));
  // feed
  if (s.log.length !== lastLogLen || force) {
    lastLogLen = s.log.length;
    const l = s.log[s.log.length - 1];
    const tk = $('#ticker');
    if (l) { tk.className = 'ticker k-' + l.kind; tk.innerHTML = `<time>${fmtT(l.t)}</time> ${escapeHtml(l.text)}`; tk.classList.remove('flash'); void tk.offsetWidth; tk.classList.add('flash'); }
  }
  // tab badge
  const rb = document.querySelector('#tabs [data-tab="reports"] .dot');
  if (rb) rb.hidden = !(s.reports.length > (ui.seenReports || 0));
  renderPanel(force);
}
const escapeHtml = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function renderPanel(force) {
  if (settings.drawer === 'closed') return;
  const panel = $('#panel');
  const active = document.activeElement;
  if (!force && active && panel.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) return;
  if (!force && pointerDown) return;
  const scroll = panel.scrollTop;
  let h = '';
  switch (ui.tab) {
    case 'steps': h = P.stepsTab(s, ui); break;
    case 'erp': h = P.erpTab(s); break;
    case 'orders': h = P.ordersTab(s, ui); break;
    case 'books': h = P.booksTab(s); break;
    case 'kpis': h = P.kpisTab(s); break;
    case 'charts': if (!force && panel.dataset.tab === 'charts') { P.drawCharts(panel, s); return; } h = P.chartsTab(); break;
    case 'staff': h = P.staffTab(s); break;
    case 'reports': ui.seenReports = s.reports.length; h = P.reportsTab(s, s.over ? finalScore(s) : null); break;
    case 'learn': h = P.learnTab(s); break;
    case 'events': h = P.eventsTab(s); break;
  }
  if (panel.dataset.html === h) return;
  panel.innerHTML = h; panel.dataset.html = h; panel.dataset.tab = ui.tab;
  panel.scrollTop = scroll;
  if (ui.tab === 'charts') P.drawCharts(panel, s);
}

function buildTabs() {
  $('#tabs').innerHTML = P.TABS.map(([id, label]) => `<button role="tab" data-tab="${id}" aria-selected="${ui.tab === id}">${label}${id === 'reports' ? '<span class="dot" hidden>!</span>' : ''}</button>`).join('');
}
function setTab(id) {
  if (settings.drawer === 'closed') setPanel('half');
  ui.tab = id;
  document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  $('#panel').scrollTop = 0;
  render(true);
}
function openStep(stepId) {
  if (settings.drawer === 'closed') setPanel('half');
  ui.openStep = stepId; setTab('steps');
  requestAnimationFrame(() => { const el = document.querySelector(`[data-step="${stepId}"]`); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
}

// ---------- modal ----------
function openModal(html, kind) { ui.modal = kind || 'modal'; $('#modal').innerHTML = html; $('#modalBack').hidden = false; $('#modal').scrollTop = 0; }
function closeModal() {
  const was = ui.modal; ui.modal = null; $('#modalBack').hidden = true; $('#modal').innerHTML = '';

}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 3200); }

function setSpeed(v) { speed = v; render(false); }
// ---------- weekly questions: a notification dock that never pauses the game ----------
const dock = { mode: 'pill', key: null, answered: null, timer: null, report: null };
function updateDock(force) {
  const wr = s && s.settings.questions ? s.weekReview : null;
  if (!wr || wr.idx >= wr.ids.length) {
    if (s && wr) s.weekReview = null;
    dock.key = null;
    if (force || $('#qdock').dataset.q === '1') drawDock();
    return;
  }
  const key = wr.end + ':' + wr.ids.length;
  if (key !== dock.key) {
    // a new week's questions arrived: show a small toast, then fold it into a pill
    dock.key = key; dock.answered = null; wr.isNew = true;
    if (dock.mode !== 'open') dock.mode = 'toast';
    clearTimeout(dock.timer);
    dock.timer = setTimeout(() => { if (dock.mode === 'toast') { dock.mode = 'pill'; drawDock(); } }, 9000);
    drawDock(); return;
  }
  if (force) drawDock();
}
function drawDock() {
  const el = $('#qdock');
  const wr = s && s.settings.questions ? s.weekReview : null;
  let h = '';
  if (dock.report != null && s && s.reports.find((r) => r.m === dock.report)) {
    const r = s.reports.find((x) => x.m === dock.report);
    h += `<div class="qcard rnote"><div class="qh"><b>📊 ${r.monthName} report is ready</b><button class="hideBtn" data-act="reportDismiss" title="Dismiss">✕</button></div>
      <p>Score ${r.score}/100 · ${r.auditFail ? (r.auditWarning ? 'auditors: warning' : 'auditors: <b class="k-bad">strike</b>') : 'auditors: accepted'} · gap ${n0x(r.gap)}</p>
      <div class="row" style="justify-content:flex-end"><button class="btn small" data-act="reportOpen">Open report</button></div></div>`;
  }
  if (wr && wr.idx < wr.ids.length) h += M.dockHtml(s, wr, dock.mode, dock.answered);
  el.dataset.q = wr ? '1' : '';
  if (el.innerHTML !== h) el.innerHTML = h;
}
const n0x = (x) => Math.round(x).toLocaleString('en-US');

// ---------- input ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act],[data-tab],[data-order],[data-report],[data-q],[data-speed],button[data-panel],button[data-size]');
  if (!el) { if (e.target === $('#modalBack') && !['question', 'question-answered', 'start', 'final'].includes(ui.modal)) closeModal(); return; }
  if (el.matches('.sp')) { if (!s || s.over) return; setSpeed(+el.dataset.speed); return; }
  if (el.dataset.panel) { setPanel(el.dataset.panel); return; }
  if (el.dataset.size) { if (settings.drawer !== 'half') setPanel('half'); setPanelWidth(settings.pw + 80 * +el.dataset.size); return; }
  if (el.dataset.tab && !el.dataset.act) { setTab(el.dataset.tab); return; }
  if (el.dataset.order && !el.dataset.act) { openModal(M.orderModal(s, el.dataset.order), 'order'); return; }
  if (el.dataset.report != null && !el.dataset.act) { openModal(M.reportModal(s, +el.dataset.report), 'report'); return; }
  if (el.dataset.q && !el.dataset.act) { const a = s.answers.find((x) => x.id === el.dataset.q); openModal(M.questionModal(s, el.dataset.q, a ? a.choice : null), 'review'); return; }
  const act = el.dataset.act;
  switch (act) {
    case 'close': closeModal(); break;
    case 'start': { const q = $('#optQ'); newGame(el.dataset.mode, q ? q.checked : true); break; }
    case 'load': loadGame(); break;
    case 'save': saveGame(false); break;
    case 'new': openModal(M.startModal(hasSave()), 'start'); break;
    case 'answer': {
      const id = el.dataset.q, i = +el.dataset.i;
      if (el.closest('#qdock')) { if (dock.answered != null) break; answerQuestion(s, id, i); dock.answered = i; drawDock(); break; }
      answerQuestion(s, id, i);
      $('#modal').innerHTML = M.questionModal(s, id, i);
      break;
    }
    case 'reportOpen': { const m = dock.report; dock.report = null; drawDock(); openModal(M.reportModal(s, m), 'report'); break; }
    case 'reportDismiss': dock.report = null; drawDock(); break;
    case 'dockOpen': if (s.weekReview) s.weekReview.isNew = false; dock.mode = 'open'; drawDock(); break;
    case 'dockHide': if (s.weekReview) s.weekReview.isNew = false; dock.mode = 'pill'; drawDock(); break;
    case 'wnext': {
      const wr = s.weekReview; if (!wr) break;
      wr.idx++; dock.answered = null;
      if (wr.idx >= wr.ids.length) { s.weekReview = null; dock.key = null; drawDock(); toast('All caught up. New questions come at the end of next week.'); }
      else drawDock();
      break;
    }
    case 'wskip': {
      const wr = s.weekReview;
      if (wr) for (const id of wr.ids.slice(wr.idx).reverse()) if (D.QUESTIONS[id] && !s.qPending.includes(id)) s.qPending.unshift(id);
      s.weekReview = null; dock.key = null; drawDock(); toast('Skipped. Key concept questions will come back next week.');
      break;
    }
    case 'choose': {
      const key = el.dataset.key, v = el.dataset.v;
      if (s.controls[key] === v && !s.pending[key]) { toast('This option is already live.'); break; }
      openModal(M.confirmModal(s, key, v), 'confirm');
      break;
    }
    case 'confirm': {
      const r = setControl(s, el.dataset.key, el.dataset.v);
      closeModal(); toast(r.ok ? r.msg : r.why); render(true);
      break;
    }
    case 'limit': {
      const id = el.dataset.dealer; const inp = document.querySelector(`[data-limit="${id}"]`);
      const r = setApprovedLimit(s, id, +inp.value); toast(r.ok ? r.msg : r.why); render(true);
      break;
    }
    case 'hire': { const r = hire(s, el.dataset.role); toast(r.ok ? r.msg : r.why); render(true); break; }
    case 'letgo': { const r = letGo(s, el.dataset.role); toast(r.ok ? 'Done.' : r.why); render(true); break; }
    case 'final': openModal(M.finalModal(s), 'final'); break;
    case 'sandbox': s.mode = 'sandbox'; s.over = null; closeModal(); toast('Sandbox: the business keeps running.'); render(true); break;
    case 'tab': closeModal(); setTab(el.dataset.tab); break;
    case 'theme': settings.theme = el.dataset.theme; saveSettings(); applyTheme(); toast('Theme changed.'); break;
    case 'toggleQ': s.settings.questions = el.checked; if (!el.checked) s.weekReview = null; updateDock(true); break;
    case 'toggleSound': settings.sound = el.checked; saveSettings(); break;
  }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (!s) return;
  if (el.dataset.act === 'orderFilter') { ui.orderFilter = el.value; render(true); }
  if (el.dataset.act === 'number') { const r = setControl(s, el.dataset.key, Math.max(+el.min, Math.min(+el.max, +el.value || 0))); toast(r.ok ? 'Threshold updated.' : r.why); el.blur(); render(true); }
  if (el.dataset.act === 'slider') { setControl(s, el.dataset.key, +el.value); toast(`Order volume ${el.value}% from next month.`); el.blur(); render(true); }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.act === 'slider') { const o = document.querySelector(`[data-out="${el.dataset.key}"]`); if (o) o.textContent = el.value + '%'; }
});
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.matches && d.matches('details.step')) { if (d.open) ui.openStep = d.dataset.step; else if (ui.openStep === d.dataset.step) ui.openStep = null; }
}, true);
let pointerDown = false;
document.addEventListener('pointerdown', () => { pointerDown = true; });
document.addEventListener('pointerup', () => { setTimeout(() => { pointerDown = false; }, 50); });

$('#btnDay').addEventListener('click', () => {
  if (!s || s.over) return;
  advanceTo(s, tOf(dayOf(s.t) + 1, DAY_START)); afterAdvance(); render(true);
});
$('#btnMonth').addEventListener('click', () => {
  if (!s || s.over) return;
  const qs = s.settings.questions;
  skipToNextClose(s);
  afterAdvance(); render(true);

});
$('#btnFull').addEventListener('click', () => {
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { toast('Full screen is not available here.'); }
});
$('#btnMenu').addEventListener('click', () => { if (s) openModal(M.menuModal(s, settings), 'menu'); });
document.addEventListener('keydown', (e) => {
  if (!s || e.target.closest('input,select,textarea')) return;
  if (e.key === 'Escape' && ui.modal && !['question', 'question-answered', 'start', 'final'].includes(ui.modal)) { closeModal(); return; }
  if (ui.modal) return;
  if (e.code === 'Space') { e.preventDefault(); setSpeed(speed ? 0 : (ui.lastSpeed || 1)); }
  if (['1', '2', '3', '4'].includes(e.key)) { ui.lastSpeed = +e.key; setSpeed(+e.key); }
});

// map interaction
function mapXY(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
canvas.addEventListener('mousemove', (e) => {
  if (!s) return;
  const [x, y] = mapXY(e); const h = hitTest(x, y);
  ui.hover = h && h.kind === 'zone' ? h.id : null;
  ui.hoverOrder = h && h.kind === 'order' ? h.id : null;
  ui.hoverStaff = h && h.kind === 'staff' ? { role: h.role, i: h.i } : null;
  canvas.style.cursor = h && (h.kind !== 'zone' || h.step || h.tab) ? 'pointer' : 'default';
});
canvas.addEventListener('mouseleave', () => { ui.hover = ui.hoverOrder = ui.hoverStaff = null; });
canvas.addEventListener('click', (e) => {
  if (!s) return;
  const [x, y] = mapXY(e); const h = hitTest(x, y);
  if (!h) return;
  if (h.kind === 'order') openModal(M.orderModal(s, h.id), 'order');
  else if (h.kind === 'dealer') openModal(M.dealerModal(s, h.id), 'dealer');
  else if (h.kind === 'staff') { ui.hoverStaff = { role: h.role, i: h.i }; toast(`${staffName(h.role, h.i)} (${D.ROLES[h.role].name}): ${h.job ? h.job.lab : 'free right now'}`); }
  else if (h.kind === 'zone') { if (h.tab) setTab(h.tab); else if (h.id === 'project') setTab('books'); else if (h.step) openStep(h.step); }
});

// ---------- sound (tiny beeps, off by default) ----------
let audio = null, soundLogIdx = 0;
function beep(freq, dur, type = 'sine', vol = 0.05) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(audio.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur); o.stop(audio.currentTime + dur);
  } catch (e) { /* no audio */ }
}
function sounds() {
  if (soundLogIdx > s.log.length) soundLogIdx = s.log.length;
  const fresh = s.log.slice(soundLogIdx); soundLogIdx = s.log.length;
  if (!settings.sound || !fresh.length) return;
  const kinds = new Set(fresh.map((l) => l.kind));
  if (kinds.has('bad')) beep(180, 0.25, 'square', 0.03);
  else if (kinds.has('cash')) { beep(880, 0.12); setTimeout(() => beep(1320, 0.15), 90); }
  else if (kinds.has('order')) beep(660, 0.1, 'triangle');
}

function applyTheme() {
  if (settings.theme) document.documentElement.dataset.theme = settings.theme; else delete document.documentElement.dataset.theme;
  requestAnimationFrame(() => { readColors(); if (s) render(true); });
}

// ---------- boot ----------
readColors(); resize(); buildTabs();
s = createGame({ mode: 'campaign', seed: 1, questions: true });
render(true);
openModal(M.startModal(hasSave()), 'start');
requestAnimationFrame(frame);
// expose for debugging and automated play-testing
window.__game = { get state() { return s; }, setSpeed, tick: (m) => { tick(m); afterAdvance(); render(true); } };

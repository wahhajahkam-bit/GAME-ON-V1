# GAME ON V1: Zenith Order-to-Cash

A 2D browser game that turns the **Zenith Cooling Supplies order-to-cash case** (Module 2, Problem 1) into a live business. You watch the process run, pause to inspect the data, change how each of the 11 steps works, and see the results month by month. Along the way you learn **when money is really counted**: order, delivery, invoice, bank, cash applied.

It runs in any web browser with nothing to install. It will be playable at `https://wahhajahkam-bit.github.io/GAME-ON-V1` once GitHub Pages is turned on.

## How the game works

- **The map** fills the screen. Dealer orders arrive as WhatsApp messages; a named Sales Executive (SE1, SE2) walks to the phone and carries the order to their desk. Staff (SM, GM, FM, BC1, WH1, WH2, DR1…) walk to their tasks. Order boxes glide from the sales desk to the ERP credit check, the credit hold, the warehouse and onto the truck, tagged with who is handling them. Coins fly to the bank on payments, invoices fly to dealers, and a red ring flashes on a policy breach.
- **Side panel**: Map only / Half / Full, and drag its edge (or − / +) to make it narrower or wider. On a phone it is a bottom sheet.
- **Time**: pause and inspect anything. Speeds: 1 day = 5 minutes, 2 minutes or 1 minute. Also **+1 day** and **Skip month**.
- **March is exact**: the 9 orders, deliveries, invoices, receipts and the limit change happen exactly as in Exhibits A–H. If you change nothing, the March report matches the solution workbook. From April, new orders come from the same dealers and products.
- **11 control panels** (Steps tab): each shows how the step works today, the policy, what is happening now, and options to switch to. Options cost money, take days to set up, may need staff, and have side effects.
- **Hidden truth**: real shelf stock is unknown until you set up counting. Forgotten invoices are invisible until you run a report.
- **Books tab**: what the ERP says next to the truth (revenue by delivery, receivables, suspense, stock, the hotel project's advance as a liability).
- **Weekly review**: no interruptions during the day. At the end of each week you get a short summary and about 5 questions, built from that week's real numbers plus the key money moments: an order is a promise, revenue on delivery, cash when it reaches the bank, a promise to pay is not enough, an advance is a liability. A big hotel contract (a scaled version of "100M project, 60M materials, 20M advance") runs from April to June.
- **Month-end report** on the 3rd of each month: KPIs (from sheet 8 of the workbook), what went wrong, booked vs earned revenue, the exception map, true profit, dealer balances and the changes you made.

**Campaign** (March to June): your score combines the KPI score, true profit and cash. You lose if the auditors reject the books twice (revenue errors above 10%; March is only a warning) or if cash runs out. **Sandbox**: no winning or losing.

Figures not in the case (opening stock, unit costs, cash, salaries, the hotel project) are assumptions and are listed in the game's Menu.

## Files

| Path | What it is |
|------|------------|
| `index.html`, `css/style.css` | The page and its styles (light and dark) |
| `js/data.js` | Case data (Exhibits A–H), the 11 steps and their options, KPIs, questions, concept cards |
| `js/sim/sim.js` | The business engine: every action is an event at a game time |
| `js/sim/report.js` | Month-end report, KPIs and score |
| `js/sim/weekly.js` | Weekly review: summary and questions from the week's numbers |
| `js/render/map.js` | The animated map (Canvas) |
| `js/ui/panels.js`, `js/ui/modals.js` | Side tabs and pop-up windows |
| `js/main.js` | Game loop, speeds, input, saving |
| `tests/` | Node checks: March reproduces the solution; fixes work; full campaigns run |

Run the checks with `npm test` (Node 18 or newer). To play locally, serve the folder (for example `python3 -m http.server`) and open `http://localhost:8000`; the game uses JavaScript modules, which browsers do not load from a plain file.

## Tech stack

- **HTML, CSS, JavaScript**: plain web technologies, no install needed.
- **HTML Canvas**: draws and animates the business map.
- **Math in JavaScript**: credit exposure, discounts and floor prices, invoices vs deliveries, revenue cut-off, receivables and ageing, stock, cycle time, KPIs and scoring.
- **Data**: the case data and settings live in `js/data.js`. Progress is saved in the browser (`localStorage`).
- **Libraries**: none.

## GitHub setup

- **Git**: version history, pushed to this repository.
- **GitHub Pages** (free): hosts the game at `https://wahhajahkam-bit.github.io/GAME-ON-V1` so anyone can play it.
- **GitHub CLI (`gh`)** (optional): for turning on Pages or making releases from the command line.

## Development steps

1. **Agree on the design** ✅
2. **Basic setup** ✅: `index.html`, game loop, keyboard/mouse/touch input, canvas that resizes to the screen.
3. **Core gameplay** ✅: the order-to-cash engine, staff, orders, stock, credit, billing, cash.
4. **Data** ✅: KPIs, month-end reports, scoring, saving.
5. **Animation and polish** ✅: walking staff, truck, questions, charts, menus, optional sound.
6. **Testing** ✅: March fidelity checks, campaign runs, browser play-tests at laptop and phone sizes.
7. **Publish**: push, turn on GitHub Pages, and share the playable link.

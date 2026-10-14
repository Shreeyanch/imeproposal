/* IME Loyalty admin. Sections: Customers (choose, add transaction, purchase flow, reward), Rewards, Points, Ledger.
   Uses IME_DATA (seed) and IME_ENGINE (logic). */
(function () {
  'use strict';
  const D = window.IME_DATA, E = window.IME_ENGINE;
  const $ = id => document.getElementById(id);
  const KEY = 'ime.bank.v1';
  const npr = E.npr;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const COLORS = ['#0f9d6e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#a16207','#64748b','#14b8a6','#d946ef'];
  const catColor = k => COLORS[Object.keys(D.CAT).indexOf(k) % COLORS.length];
  const BIZ_ORDER = ['mymart', 'khalti', 'bank', 'dishhome', 'ila', 'partner'];
  const TABS = { customers:'Customers', offers:'Offers', rewards:'Rewards', points:'Points', ledger:'Ledger', context:'Context' };
  const STEPS = [['pick', 'Choose customer'], ['customer', 'Add transaction'], ['flow', 'Purchase flow'], ['reward', 'Offer and points']];
  const byId = id => S.personas.find(p => p.id === id);
  const initials = n => n.split(' ').map(w => w[0]).join('').slice(0, 2);

  let S = null;
  const ui = { tab:'customers', step:'pick', pid:null, previewPid:null, previewTab:'home', promoDismissed:false, peoplePage:0, q:'', rid:null, checkRun:false, shown:8, animating:false, runId:0, skip:false, confirmReset:false };

  /* ---------- storage ---------- */
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save on this device.'); } }
  function load() { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.personas && v.ledger ? v : null; } catch (e) { return null; } }
  function fresh() {
    S = { cfg:{ pv:1, share:0.10, tiers:E.DEFAULT_TIERS.map(t => ({...t})) }, personas:D.makePeople(), rewards:D.makeRewards(), offers:D.makeOffers(), flow:null, offerRedemptions:[], ledger:[], settlements:[], jeSeq:0 };
    S.personas.forEach(p => E.applySeedTiers(S, p));
    E.seedLedger(S);
    S.personas.forEach(p => { p.lastRec = null; });
    save();
    return S;
  }
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- small helpers ---------- */
  function avatar(p) {
    const i = +p.id.slice(3) - 1001;
    const skin = ['#f2cba8','#dcaa80','#b9825a','#8e5b3c'][i % 4], hair = ['#2a1c12','#4b3322','#1d1b19','#6b4a2e'][i % 4], hue = (i * 67) % 360;
    return `<svg viewBox="0 0 96 96" role="img" aria-label="Picture of ${esc(p.name)}"><rect width="96" height="96" fill="hsl(${hue} 65% 90%)"/><path d="M14 96c2-20 16-30 34-30s32 10 34 30z" fill="hsl(${hue} 45% 58%)"/>${p.g === 'F' ? `<path d="M30 40c0-16 8-24 18-24s18 8 18 24v20c0 6-4 8-6 8H36c-2 0-6-2-6-8z" fill="${hair}"/>` : ''}<ellipse cx="48" cy="42" rx="15" ry="17" fill="${skin}"/><path d="M32 38c0-12 7-18 16-18s16 6 16 18c-4-5-9-7-16-7s-12 2-16 7z" fill="${hair}"/><circle cx="42" cy="44" r="1.8" fill="#222"/><circle cx="54" cy="44" r="1.8" fill="#222"/><path d="M43 52c3 2 7 2 10 0" stroke="#7a3d2a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
  }
  function pie(cats, total) {
    if (!total) return '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#e2e8f0"/></svg>';
    if (cats.length === 1) return `<svg viewBox="0 0 120 120" role="img" aria-label="Spending pie chart"><circle cx="60" cy="60" r="56" fill="${catColor(cats[0][0])}"/></svg>`;
    let a = -Math.PI / 2, out = '';
    cats.forEach(([k, v]) => {
      const b = a + v / total * Math.PI * 2;
      const x0 = 60 + 56 * Math.cos(a), y0 = 60 + 56 * Math.sin(a), x1 = 60 + 56 * Math.cos(b), y1 = 60 + 56 * Math.sin(b);
      out += `<path d="M60 60L${x0.toFixed(2)} ${y0.toFixed(2)}A56 56 0 ${b - a > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z" fill="${catColor(k)}" stroke="#fff" stroke-width="1"/>`;
      a = b;
    });
    return `<svg viewBox="0 0 120 120" role="img" aria-label="Spending pie chart">${out}</svg>`;
  }
  function customerPhoneHTML(p, flow, note) {
    const f = flow && flow.pid === p.id ? flow : null;
    const pointsFromPayment = f ? E.ptsOf(S, {amount:f.amount, biz:f.biz, tierMultiplier:f.tierMultiplier}) : 0;
    const pending = !!(f && ui.step === 'flow' && ui.animating && ui.shown < 8);
    const offer = f && !pending && f.offerId ? S.offers.find(x => x.id === f.offerId) : null;
    const tier = E.tierOf(S, p);
    const eligible = E.availableRewards(S, p).eligible;
    const rewards = eligible.length;
    const shownBalance = pending ? E.balance(S, p) - pointsFromPayment : E.balance(S, p);
    const rewardView = ui.previewTab === 'rewards';
    const offerView = ui.previewTab === 'offers';
    const rewardItems = eligible.slice(0, 6).map(r => `<div class="wallet-reward-row"><span class="wallet-reward-icon">✦</span><div><b>${esc(r.name)}</b><small>${esc(r.issuer)}</small></div><strong>${E.ptsReq(S, r).toLocaleString('en-US')} pts</strong></div>`).join('');
    return `<aside class="customer-preview" id="customerPreview"><div class="preview-heading"><div><b>Customer app preview</b><span>Payment and loyalty experience</span></div><span class="live-dot">● Live preview</span></div>
      <div class="phone-frame"><div class="phone-screen"><div class="phone-content">
        <div class="wallet-status"><span>9:41</span><span>●●● &nbsp; ▰</span></div>
        <div class="wallet-header"><div class="wallet-brand"><span class="wallet-mark">i</span><div><b>IME</b><small>LOYALTY WALLET</small></div></div><button class="wallet-avatar" aria-label="Customer profile">${esc(initials(p.name))}</button></div>
        <div class="wallet-tier"><span>${esc(tier.name)} MEMBER</span><b>${tier.multiplier}× points</b></div>
        ${rewardView ? `<div class="wallet-page-title"><small>REWARDS</small><h2>Choose your reward</h2><p>${esc(p.name.split(' ')[0])}, you have ${E.balance(S, p).toLocaleString('en-US')} points.</p></div>
          <div class="wallet-reward-list">${rewardItems || '<div class="phone-empty-offer"><b>No rewards available yet</b><p>Earn more points with eligible payments.</p></div>'}</div>${rewards > 6 ? `<div class="wallet-more">Showing 6 of ${rewards} rewards · browse full list on the left</div>` : ''}` : `<div class="wallet-greeting"><small>YOUR WALLET</small><h2>Hello, ${esc(p.name.split(' ')[0])}</h2></div>
          <div class="phone-points"><small>LOYALTY POINTS</small><strong>${shownBalance.toLocaleString('en-US')} <span>pts</span></strong><div>${pending ? 'Payment is being confirmed' : f ? '+' + pointsFromPayment + ' points earned' : 'Earn points when you pay'}</div></div>
          ${f ? `<div class="phone-payment ${pending ? 'is-pending' : 'is-paid'}"><span class="phone-check">${pending ? '…' : '✓'}</span><div><b>${pending ? 'Processing payment' : 'Paid successfully'}</b><small>${npr(f.amount)} · ${esc(f.merchant)}</small></div><span class="paid-tag">${pending ? 'WAIT' : 'PAID'}</span></div>` : ''}
          <div class="phone-section-title"><b>${offerView ? 'Offer details' : f && !pending ? 'Offer unlocked' : 'Offers for you'}</b><button class="wallet-link" data-phone-tab="offers">View all</button></div>
          ${offer ? `<div class="phone-offer"><div class="phone-offer-top"><span class="offer-icon">%</span><span class="phone-offer-label">${offer.discountPct}% OFF · ${esc(offer.issuer)}</span></div><h3>${esc(offer.name)}</h3><p>${esc(offer.desc)}</p><div class="phone-code"><span>COUPON CODE</span><b>${esc(offer.coupon)}</b></div><small>Apply this code on the merchant’s site</small></div>` : `<div class="phone-empty-offer"><span class="coupon-icon">%</span><b>${pending ? 'Your offer is on its way' : 'No offer for this payment'}</b><p>${esc(pending ? 'We’ll show a matching deal after confirmation.' : note || 'Matching offers appear here after an eligible payment.')}</p></div>`}
          ${f && !pending ? `<div class="wallet-success-note"><span>✓</span><div><b>Payment complete</b><small>Your points are added. The offer is optional.</small></div></div>` : ''}
          <button class="wallet-rewards-cta" data-phone-tab="rewards"><span class="wallet-reward-icon">✦</span><span><b>Redeem rewards</b><small>${rewards} available with your points</small></span><strong>›</strong></button>`}
        </div>
        ${f && !pending && offer && !rewardView && !offerView && !ui.promoDismissed ? `<div class="wallet-promo-backdrop"><section class="wallet-promo-sheet"><button class="wallet-promo-close" data-dismiss-promo aria-label="Close offer">×</button><span class="wallet-promo-check">✓</span><small>PAYMENT SUCCESSFUL</small><h2>Offer for you</h2><p>${esc(offer.name)} · ${offer.discountPct}% off</p><div class="wallet-promo-actions"><button class="wallet-promo-use" data-phone-tab="offers">View offer</button><button class="wallet-promo-rewards" data-phone-tab="rewards">Redeem rewards</button></div></section></div>` : ''}
        <div class="phone-nav"><button data-phone-tab="home" class="${!rewardView && !offerView ? 'active' : ''}"><span>⌂</span><small>Home</small></button><button data-phone-tab="offers" class="${offerView ? 'active' : ''}"><span>▧</span><small>Offers</small></button><button data-phone-tab="rewards" class="${rewardView ? 'active' : ''}"><span>✦</span><small>Rewards</small></button><button><span>◉</span><small>Profile</small></button></div>
      </div></div><p class="phone-caption">Customer view · not a real payment or wallet session</p></aside>`;
  }
  const head = (title, desc, actions) => `<div class="pagehead"><div><h1>${title}</h1>${desc ? `<p class="muted">${desc}</p>` : ''}</div>${actions ? `<div class="cta">${actions}</div>` : ''}</div>`;
  const stat = (k, v, d, sm) => `<div class="stat"><div class="k">${k}</div><div class="v${sm ? ' sm' : ''}">${v}</div>${d ? `<div class="d">${d}</div>` : ''}</div>`;

  /* ---------- customers: stepper ---------- */
  function stepperHTML() {
    const at = STEPS.findIndex(s => s[0] === ui.step);
    return `<ol class="steps" aria-label="Progress">${STEPS.map((s, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"${i === at ? ' aria-current="step"' : ''}><b>${i < at ? '✓' : i + 1}</b>${s[1]}</li>`).join('')}</ol>`;
  }

  /* step 1 */
  function peopleCardsHTML() {
    const q = ui.q.trim().toLowerCase();
    const list = S.personas.filter(p => !q || (p.name + ' ' + p.city + ' ' + p.seg + ' ' + p.id).toLowerCase().includes(q));
    const start = ui.peoplePage * 3, page = list.slice(start, start + 3);
    if (!list.length) return '<div class="empty-card">No customers match this search.</div>';
    return page.map(p => { const tier = E.tierOf(S, p); return `<article class="person-card${ui.previewPid === p.id ? ' selected' : ''}" role="button" tabindex="0" data-person="${p.id}"><div class="person-card-top"><span class="pic">${avatar(p)}</span><div><strong>${esc(p.name)}</strong><div class="muted xs">${esc(p.city)} · ${esc(p.seg)}</div><span class="tier-chip ${tier.id}">${esc(tier.name)} · ${tier.multiplier}×</span></div><span class="card-arrow">›</span></div><div class="person-card-stats"><span><b>${E.balance(S, p).toLocaleString('en-US')}</b><small>points</small></span><span><b>${npr(E.metrics(p).monthly)}</b><small>monthly spend</small></span></div><div class="person-card-action">Choose customer</div></article>`; }).join('');
  }
  function peoplePageHTML(total) {
    return `<button class="ghost" id="peoplePrev" ${ui.peoplePage === 0 ? 'disabled' : ''}>← Previous</button><span class="muted xs">${total ? ui.peoplePage * 3 + 1 : 0}–${Math.min((ui.peoplePage + 1) * 3, total)} of ${total}</span><button class="ghost" id="peopleNext" ${((ui.peoplePage + 1) * 3 >= total) ? 'disabled' : ''}>Next →</button>`;
  }
  function pickHTML() {
    const p = byId(ui.previewPid) || S.personas[0], q = ui.q.trim().toLowerCase();
    const total = S.personas.filter(x => !q || (x.name + ' ' + x.city + ' ' + x.seg + ' ' + x.id).toLowerCase().includes(q)).length;
    return `<div class="customer-workspace"><section><div class="toolbar"><input id="search" type="search" placeholder="Search customers" value="${esc(ui.q)}" aria-label="Search customers"><span class="muted xs">Choose a profile to preview it.</span></div>
      <div class="people-grid" id="peopleGrid">${peopleCardsHTML()}</div><div class="people-pagination" id="peoplePagination">${peoplePageHTML(total)}</div></section>
      ${customerPhoneHTML(p, null, 'Choose a customer and add a payment to preview their points and offer.')}</div>`;
  }

  /* step 2 */
  function customerHTML() {
    const p = byId(ui.pid), m = E.metrics(p);
    const cats = Object.entries(m.byCat).sort((a, b) => b[1] - a[1]);
    const available = E.availableRewards(S, p);
    const legend = cats.map(([k, v]) => `<div><i style="background:${catColor(k)}"></i><span>${esc(D.CAT[k].l)}</span><span class="num">${Math.round(v / m.total * 100)}%</span></div>`).join('');
    const rows = p.tx.slice(0, 6).map(t => `<tr><td>${t.date}</td><td>${esc(t.merchant)}<div class="sub">${esc(D.BIZ[t.biz].name)}</div></td><td class="num">${npr(t.amount)}</td><td class="num">${E.ptsOf(S, t)}</td></tr>`).join('');
    const got = p.rewards.length ? p.rewards.slice(0, 4).map(x => esc(x.name) + ' · ' + x.date).join('<br>') : 'None yet';
    return `<div class="customer-workspace"><div class="stack">
      <div class="card"><div class="card-b profile">
        <span class="pic">${avatar(p)}</span>
        <div style="flex:1;min-width:200px"><h2 style="font-size:17px">${esc(p.name)}</h2><p class="muted xs">${p.id} · ${p.age} years · ${esc(p.job)} · ${esc(p.area)}, ${esc(p.city)}</p></div>
        <div class="cta"><button class="ghost" id="backPick">Change customer</button><button class="pri lg" id="addTx">+ Add transaction</button></div>
      </div></div>
      <div class="callout"><b>Next:</b> add a transaction to calculate cashback points and see a matching offer. ${esc(p.name.split(' ')[0])} can browse eligible rewards separately.</div>
      <div class="grid">${stat('Points balance', E.balance(S, p).toLocaleString('en-US'))}${stat('Tier', E.tierOf(S, p).name, E.tierOf(S, p).multiplier + '× points')}${stat('Recorded spend', npr(m.total))}${stat('Rewards available', available.eligible.length + ' of ' + available.all, '', true)}</div>
      <div class="split">
        <div class="card"><div class="card-h"><h2>Recent transactions</h2></div><div class="tbl" style="border:0;border-radius:0"><table><thead><tr><th>Date</th><th>Merchant</th><th class="num">Amount</th><th class="num">Points</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        <div class="stack"><div class="card"><div class="card-h"><h2>Spending by category</h2></div><div class="card-b pie">${pie(cats, m.total)}<div class="legend">${legend}</div></div></div>
        <div class="card"><div class="card-h"><h2>Rewards received</h2></div><div class="card-b xs muted">${got}</div></div></div>
      </div></div>${customerPhoneHTML(p, null, 'Add a payment to see a live offer and cashback points here.')}</div>`;
  }
  function openTx() {
    const p = byId(ui.pid);
    $('txFor').textContent = p.name + ' · ' + p.id;
    $('txCat').innerHTML = Object.keys(D.CAT).map(k => `<option value="${k}">${esc(D.CAT[k].l)} · ${esc(D.BIZ[D.CAT[k].b].name)}</option>`).join('');
    $('txForm').reset();
    $('txDate').value = D.TODAY; $('txDate').max = D.TODAY;
    $('txErr').textContent = '';
    calcTx();
    $('txDlg').showModal();
    $('txAmt').focus();
  }
  function calcTx() {
    const amt = +($('txAmt').value.replace(/[,\s]/g, '')) || 0;
    const p = byId(ui.pid), biz = D.CAT[$('txCat').value].b;
    const tier = E.tierForSpend(S, E.metrics(p).total + amt);
    const cb = amt * D.BIZ[biz].margin * S.cfg.share * tier.multiplier;
    $('txCalc').innerHTML = `<b>${esc(D.CAT[$('txCat').value].l)}</b> · ${esc(D.BIZ[biz].name)} margin <b>${(D.BIZ[biz].margin * 100).toFixed(1)}%</b> × base share <b>${(S.cfg.share * 100).toFixed(0)}%</b> × <b>${tier.name} ${tier.multiplier}×</b> = <b>${npr(cb)}</b> cashback = <b>${Math.floor(cb / S.cfg.pv)} points</b>`;
  }
  function saveTx(e) {
    e.preventDefault();
    const amt = $('txAmt').value.replace(/[,\s]/g, ''), date = $('txDate').value, cat = $('txCat').value, mer = $('txMer').value.trim();
    let err = '';
    if (!/^\d+$/.test(amt) || +amt < 1 || +amt > 500000) err = 'Enter a whole amount from 1 to 500,000.';
    else if (!date || date > D.TODAY) err = 'Pick a date up to today.';
    else if (mer.length > 60) err = 'The merchant name is longer than 60 characters.';
    if (err) { $('txErr').textContent = err; return; }
    const p = byId(ui.pid), prev = p.lastRec;
    const tier = E.tierForSpend(S, E.metrics(p).total + +amt);
    const t = { id:'N' + Date.now().toString(36), date, cat, biz:D.CAT[cat].b, amount:+amt, merchant:mer || D.CAT[cat].l, src:'entry', tierName:tier.name, tierMultiplier:tier.multiplier };
    p.tx.unshift(t); p.tx.sort((a, b) => b.date.localeCompare(a.date));
    const f = E.buildFlow(S, p, t, prev);
    const pts = E.ptsOf(S, t);
    if (pts > 0) f.earnJe = E.postEntry(S, [
      { account:'Cashback expense, ' + D.BIZ[t.biz].name, dr:pts * S.cfg.pv },
      { account:'Customer points liability', cr:pts * S.cfg.pv }
    ], t.id, p.name + ' purchase at ' + t.merchant);
    p.lastRec = f.rid;
    S.flow = f;
    save();
    $('txDlg').close();
    ui.tab = 'customers';
    runFlow();
  }

  /* step 3: flow */
  function hopsFor(f) {
    const si = Math.max(0, BIZ_ORDER.indexOf(f.biz));
    return [
      { path:'p-src-' + si, pulse:'n-int', mk:'mk1', upTo:3 },
      { path:'p-int-ledger', pulse:'n-ledger', mk:'mk2', upTo:4 },
      { path:'p-ledger-points', pulse:'n-points', mk:'mk3', upTo:5 },
      { path:'p-points-reward', pulse:'n-reward', mk:'mk4', upTo:6 },
      { path:'p-reward-settle', pulse:'n-settle', mk:'mk5', upTo:7 },
      { path:'p-settle-pwa', pulse:'n-pwa', mk:'mk6', upTo:8 }
    ];
  }
  function diagramSVG(f, shown) {
    const si = Math.max(0, BIZ_ORDER.indexOf(f.biz));
    const xs = i => 30 + i * 154, cx = i => xs(i) + 68;
    const seg = (id, d, upTo) => `<path id="${id}" class="seg${shown >= upTo ? ' done' : ''}" d="${d}"/>`;
    const mk = (id, x, y, label, upTo) => `<g class="mk${shown >= upTo ? ' on' : ''}" id="${id}"><circle cx="${x}" cy="${y}" r="15"/><text x="${x}" y="${y}">${label}</text></g>`;
    const srcSegs = BIZ_ORDER.map((k, i) => seg('p-src-' + i, `M${cx(i)} 100 L${cx(i)} 190`, i === si ? 3 : 99)).join('');
    const srcNodes = BIZ_ORDER.map((k, i) => `<g class="node" id="n-src-${i}"><rect x="${xs(i)}" y="40" width="136" height="60" rx="8"${i === si ? ' style="stroke:#0f9d6e;stroke-width:2.5"' : ''}/><text class="t" style="font-size:12.5px" x="${cx(i)}" y="65" text-anchor="middle">${esc(D.BIZ[k].name)}</text><text class="s" x="${cx(i)}" y="85" text-anchor="middle">${esc(D.BIZ[k].sys)}</text></g>`).join('');
    return `<svg viewBox="0 0 1000 520" role="img" aria-label="Flow from the source system through validation, points, offer matching, rewards catalog and customer payment screen">
      ${srcSegs}${srcNodes}
      <g class="node" id="n-int"><rect x="30" y="190" width="940" height="60" rx="8"/><text class="t" x="500" y="215" text-anchor="middle">Integration and event layer</text><text class="s" x="500" y="236" text-anchor="middle">capture · validate · identify customer</text></g>
      ${seg('p-int-ledger', 'M160 250 L160 300', 4)}
      ${seg('p-ledger-points', 'M290 340 L370 340', 5)}
      ${seg('p-points-reward', 'M630 340 L710 340', 6)}
      ${seg('p-reward-settle', 'M840 380 L840 440', 7)}
      ${seg('p-settle-pwa', 'M710 475 L290 475', 8)}
      <g class="node plat" id="n-ledger"><rect x="30" y="300" width="260" height="80" rx="8"/><text class="t" x="160" y="330" text-anchor="middle">Ledger</text><text class="s" x="160" y="352" text-anchor="middle">double-entry journal</text></g>
      <g class="node plat" id="n-points"><rect x="370" y="300" width="260" height="80" rx="8"/><text class="t" x="500" y="330" text-anchor="middle">Cashback engine</text><text class="s" x="500" y="352" text-anchor="middle">margin × share × tier ÷ point value</text></g>
      <g class="node plat" id="n-reward"><rect x="710" y="300" width="260" height="80" rx="8"/><text class="t" x="840" y="330" text-anchor="middle">Offer engine</text><text class="s" x="840" y="352" text-anchor="middle">match transaction to coupons</text></g>
      <g class="node" id="n-settle"><rect x="710" y="440" width="260" height="60" rx="8"/><text class="t" x="840" y="465" text-anchor="middle">Rewards catalog</text><text class="s" x="840" y="485" text-anchor="middle">customer chooses with points</text></g>
      <g class="node" id="n-pwa"><rect x="30" y="440" width="260" height="60" rx="8"/><text class="t" x="160" y="465" text-anchor="middle">Payment screen</text><text class="s" x="160" y="485" text-anchor="middle">points earned + offer code</text></g>
      ${mk('mk1', cx(si), 145, '1-3', 3)}${mk('mk2', 160, 275, '4', 4)}${mk('mk3', 330, 340, '5', 5)}${mk('mk4', 670, 340, '6', 6)}${mk('mk5', 840, 410, '7', 7)}${mk('mk6', 500, 475, '8', 8)}
      <circle id="pkt" r="7" cx="0" cy="0" opacity="0"/>
    </svg>`;
  }
  function checksHTML(f) {
    return f.cps.map(c => {
      const on = c.n <= ui.shown;
      return `<li class="${on ? 'on' : ''}${on && c.warn ? ' warn' : ''}"><details${on ? '' : ' inert'}><summary><span class="n">${on ? '✓' : c.n}</span>${esc(c.stage)}<span class="st">${on ? (c.warn ? 'review' : 'passed') : 'waiting'}</span></summary>${on ? `<pre>${esc(c.data)}</pre><div class="xs muted">${esc(c.rules)}</div>` : ''}</details></li>`;
    }).join('');
  }
  function flowCtaHTML() {
    return ui.animating
      ? `<button id="skipBtn">Skip animation</button>`
      : `<button class="pri lg" id="toReward">See offer and rewards</button><button class="ghost" id="replayBtn">Replay</button>`;
  }
  function flowHTML() {
    const f = S.flow;
    const p = byId(f.pid);
    return `<div class="customer-workspace flow-workspace"><div class="stack"><div class="callout">${ui.animating ? `Processing ${npr(f.amount)} for ${esc(f.customer)}.` : `Done. The customer preview now shows points and the matching offer.`}</div>
      <div class="diagram">${diagramSVG(f, ui.shown)}</div>
      <ul class="checks" id="checks" style="margin:0">${checksHTML(f)}</ul>
      <div class="cta" id="flowCta">${flowCtaHTML()}</div></div>${customerPhoneHTML(p, f, 'The customer sees this after the payment checks finish.')}</div>`;
  }
  function hop(id) {
    return new Promise(res => {
      const path = $(id), pkt = $('pkt');
      if (!path || !pkt) { res(); return; }
      const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const len = path.getTotalLength(), dur = reduce ? 0 : 800, t0 = performance.now();
      path.classList.add('lit'); pkt.setAttribute('opacity', 1);
      const step = now => {
        const t = dur ? Math.min(1, (now - t0) / dur) : 1;
        const p = path.getPointAtLength(t * len);
        pkt.setAttribute('cx', p.x); pkt.setAttribute('cy', p.y);
        if (t < 1 && !ui.skip) requestAnimationFrame(step);
        else { pkt.setAttribute('opacity', 0); path.classList.remove('lit'); path.classList.add('done'); res(); }
      };
      requestAnimationFrame(step);
    });
  }
  function pulse(node) { const el = $(node); if (!el) return; el.classList.add('hot'); setTimeout(() => el.classList.remove('hot'), 500); }
  function mark(id) { const el = $(id); if (el) el.classList.add('on'); }
  function updateFlow() {
    const c = $('checks'); if (c && S.flow) c.innerHTML = checksHTML(S.flow);
    const b = $('flowCta'); if (b) b.innerHTML = flowCtaHTML();
    const preview = $('customerPreview');
    if (preview && S.flow) preview.outerHTML = customerPhoneHTML(byId(S.flow.pid), S.flow, 'The customer sees this after the payment checks finish.');
  }
  async function runFlow() {
    const f = S.flow; if (!f) return;
    const id = ++ui.runId;
    ui.tab = 'customers'; ui.step = 'flow'; ui.previewTab = 'home'; ui.promoDismissed = false; ui.animating = true; ui.shown = 0; ui.skip = false;
    render();
    window.scrollTo({ top:0 });
    for (const h of hopsFor(f)) {
      if (id !== ui.runId) return;
      if (!ui.skip) { pulse(h.pulse); await hop(h.path); }
      if (id !== ui.runId) return;
      mark(h.mk); ui.shown = h.upTo; updateFlow();
    }
    if (id !== ui.runId) return;
    ui.animating = false; ui.skip = false; ui.shown = 8; render();
  }

  /* step 4: suggested offer plus a separate points and rewards snapshot */
  function ledgerTable(lines) {
    return `<div class="tbl"><table><thead><tr><th>Entry</th><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>${lines.map(l => `<tr><td>${l.je}</td><td>${esc(l.account)}</td><td class="num">${l.dr ? npr(l.dr) : ''}</td><td class="num">${l.cr ? npr(l.cr) : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function rewardStepHTML() {
    const f = S.flow, p = byId(f.pid);
    const offer = (S.offers || []).find(x => x.id === f.offerId);
    const available = E.availableRewards(S, p);
    const rewardRows = available.eligible.slice(0, 6).map(r => `<tr><td>${esc(r.name)}<div class="sub">${esc(r.issuer)}</div></td><td class="num">${E.ptsReq(S, r).toLocaleString('en-US')} pts</td><td class="num">${r.stock - r.issued}</td></tr>`).join('');
    const nav = `<div class="cta"><button class="pri" id="newOne">New purchase for another customer</button><button class="ghost" id="backFlow">Back to flow</button></div>`;
    const lines = S.ledger.filter(l => l.ref === f.txId);
    return `<div class="customer-workspace"><div class="stack">
      <div class="grid">${stat('Points earned', E.ptsOf(S, {amount:f.amount, biz:f.biz, tierMultiplier:f.tierMultiplier}).toLocaleString('en-US'))}${stat('Updated balance', E.balance(S, p).toLocaleString('en-US'))}${stat('Tier', f.tierName + ' · ' + f.tierMultiplier + '×')}${stat('Rewards eligible', available.eligible.length + ' of ' + available.all)}</div>
      <div class="card"><div class="card-h"><div><h2>Offer for this payment</h2><p class="muted xs">Optional coupon; not paid for with points.</p></div><span class="badge ${offer ? 'ok' : 'warn'}">${offer ? 'Suggested offer' : 'No match'}</span></div>
        <div class="card-b">${offer ? `<h3>${esc(offer.name)}</h3><p>${esc(offer.desc)}</p><div class="calc">Coupon code <b>${esc(offer.coupon)}</b> · ${offer.discountPct}% off · ${esc(offer.issuer)}</div><p class="muted xs">When the merchant reports this code was used, IME can earn under the partner agreement. This demo does not book commission until usage and agreed terms are recorded.</p>` : '<p class="muted">No active offer matches this purchase category.</p>'}</div></div>
      <div class="card"><div class="card-h"><div><h2>Rewards this customer can browse</h2><p class="muted xs">No reward is automatically suggested. Redeeming a reward is a separate customer choice.</p></div><span class="badge">${available.eligible.length} eligible</span></div>
        <div class="tbl" style="border:0;border-radius:0"><table><thead><tr><th>Reward</th><th class="num">Points needed</th><th class="num">In stock</th></tr></thead><tbody>${rewardRows || '<tr><td colspan="3" class="muted">No rewards currently meet the points, stock, date, and limit rules.</td></tr>'}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h2>Points ledger posting</h2></div><div class="card-b">${lines.length ? ledgerTable(lines) : '<p class="muted xs">No cashback points were posted for this transaction.</p>'}</div></div>
      ${nav}
    </div>${customerPhoneHTML(p, f, 'The matching payment offer and points appear here.')}</div>`;
  }
  function doApprove() {
    const f = S.flow;
    if (!f || ui.animating) return;
    const res = E.approve(S, f);
    if (res.error) { toast(res.error); return; }
    save(); render();
    toast('Approved. Posted as ' + res.je + '.');
  }
  function customersHTML() {
    const body = ui.step === 'customer' && ui.pid ? customerHTML() : ui.step === 'flow' && S.flow ? flowHTML() : ui.step === 'reward' && S.flow ? rewardStepHTML() : pickHTML();
    const titles = { pick:'Customers', customer:'Customer', flow:'Purchase flow', reward:'Offer and points' };
    return head(titles[ui.step] || 'Customers') + stepperHTML() + body;
  }

  /* ---------- offers ---------- */
  function offersHTML() {
    const rows = (S.offers || []).map(o => `<tr><td><div style="font-weight:500">${esc(o.name)}</div><div class="sub">${esc(o.desc)}</div></td><td>${esc(o.issuer)}<div class="sub">${esc(D.BIZ[o.link].name)}</div></td><td>${esc(D.CAT[o.cat] ? D.CAT[o.cat].l : 'Any payment')}</td><td><code>${esc(o.coupon)}</code></td><td class="num">${o.discountPct}%</td><td class="num">${o.link === 'partner' && o.commissionPct ? o.commissionPct + '%' : o.link === 'partner' ? 'Terms needed' : 'IME brand'}</td><td><span class="badge ${o.status === 'active' ? 'ok' : ''}">${esc(o.status)}</span></td></tr>`).join('');
    const offerOptions = (S.offers || []).filter(o => o.link === 'partner').map(o => `<option value="${esc(o.id)}">${esc(o.name)} · ${esc(o.coupon)}</option>`).join('');
    const uses = (S.offerRedemptions || []).slice(0, 20).map(x => `<tr><td>${esc(x.date)}</td><td>${esc(x.coupon)} · ${esc(x.issuer)}</td><td>${esc(x.reference)}</td><td class="num">${npr(x.saleAmount)}</td><td class="num">${x.commissionPct}%</td><td class="num">${npr(x.amount)}</td></tr>`).join('');
    return head('Offers', 'Optional coupons suggested from the payment category. Offers are separate from points and rewards.') +
      `<div class="callout" style="margin-bottom:16px"><b>How IME earns:</b> the merchant reports a coupon redemption with its code and order reference. IME records the agreed commission on that sale. Coupon codes alone do not create income; use must be reported and the partner rate agreed.</div>
      <details class="help"><summary>Offer tracking and revenue</summary><ol><li>The payment flow displays a matching active coupon, even when the customer has no points.</li><li>The customer uses the code on the merchant's checkout.</li><li>The merchant or ecommerce integration sends IME the code, order reference, and eligible sale amount.</li><li>Demo formula: eligible partner sale × the agreed commission rate = IME commission receivable. Coupon redemption does not issue points. The contract must define the sale amount used for the calculation.</li></ol></details>
      <details class="help"><summary>Set partner commission terms</summary><form id="offerTermsForm" class="stack"><div class="two"><label>Partner offer<select id="offerTermsId">${offerOptions}</select></label><label>Agreed commission (% of eligible sale)<input id="offerTermsRate" type="number" min="0.01" max="100" step="0.01" placeholder="Contract rate"></label></div><div class="err" id="offerTermsErr" role="alert"></div><button class="pri" type="submit">Save partner terms</button></form></details>
      <details class="help"><summary>Record partner-reported coupon use</summary><form id="offerUseForm" class="stack"><div class="two"><label>Offer<select id="offerUseId">${offerOptions}</select></label><label>Eligible partner sale amount (NPR)<input id="offerSale" inputmode="numeric" placeholder="2500"></label></div><label>Partner order reference<input id="offerRef" maxlength="80" placeholder="Order reference from merchant"></label><p class="muted xs">Uses the commission rate saved for this offer. For this demo, usage is entered from the partner report. An ecommerce/API integration would send it automatically.</p><div class="err" id="offerErr" role="alert"></div><button class="pri" type="submit">Record confirmed use</button></form></details>
      <div class="tbl"><table><thead><tr><th>Offer</th><th>Merchant</th><th>Applies to</th><th>Coupon code</th><th class="num">Discount</th><th class="num">Commission terms</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h2>Tracked coupon earnings</h2>${uses ? `<div class="tbl"><table><thead><tr><th>Date</th><th>Offer</th><th>Order ref</th><th class="num">Partner sale</th><th class="num">Rate</th><th class="num">IME earns</th></tr></thead><tbody>${uses}</tbody></table></div>` : '<p class="muted xs">No coupon use has been reported yet.</p>'}`;
  }
  function saveOfferUse(e) {
    e.preventDefault();
    const amountRaw = $('offerSale').value.replace(/[ ,]/g, '');
    const result = E.recordOfferUse(S, $('offerUseId').value, +amountRaw, $('offerRef').value.trim());
    if (result.error) { $('offerErr').textContent = result.error; return; }
    save(); render(); toast('Coupon use recorded. IME commission revenue: ' + npr(result.item.amount) + '.');
  }
  function saveOfferTerms(e) {
    e.preventDefault();
    const result = E.setOfferTerms(S, $('offerTermsId').value, +$('offerTermsRate').value);
    if (result.error) { $('offerTermsErr').textContent = result.error; return; }
    save(); render(); toast('Partner commission terms saved for this offer.');
  }

  /* ---------- rewards ---------- */
  function rewardsHTML() {
    const rows = S.rewards.map(r => {
      return `<tr class="clk${ui.rid === r.id ? ' sel' : ''}" tabindex="0" data-reward="${r.id}"><td><div style="font-weight:500">${esc(r.name)}</div><div class="sub">${esc(r.issuer)}</div></td><td><span class="badge ${r.type === 'Third-party' ? 'warn' : ''}">${esc(r.type)}</span>${r.custom ? ' <span class="badge">Custom</span>' : ''}</td><td class="num">${E.ptsReq(S, r)}</td><td class="num">${r.stock - r.issued}</td><td><span class="badge ${r.status === 'active' ? 'ok' : ''}">${esc(r.status)}</span></td></tr>`;
    }).join('');
    const r = S.rewards.find(x => x.id === ui.rid);
    let det = '';
    if (r) {
      const s = E.settlementFor(S, r);
      const customer = ui.pid ? byId(ui.pid) : null;
      const canRedeem = customer && E.availableRewards(S, customer).eligible.some(x => x.id === r.id);
      det = `<div class="card" style="margin-bottom:16px"><div class="card-h"><h2>${esc(r.name)}</h2><button class="ghost" data-close-reward="1">Close</button></div><div class="card-b stack">${r.desc ? `<p class="muted">${esc(r.desc)}</p>` : ''}
        <div class="grid">${stat('Points customer uses', E.ptsReq(S, r))}${stat('Provider payout', npr(s.cost))}${stat('IME gross spread', npr(s.spread))}</div>
        <div class="calc"><b>Settlement</b><br>${npr(s.pointsValue)} points value − ${npr(s.cost)} provider payout = <b>${npr(s.spread)} gross spread for IME</b>.<br>Customer pays NPR 0 cash. IME pays the provider the agreed payout after redemption.</div>
        <p class="muted xs">This is gross spread, before operating costs, tax, and any other agreed charges. Redemption is available only when this spread is positive.</p>
        <div class="muted xs">${esc(r.issuer)} · ${r.stock - r.issued} remaining · valid ${r.start} to ${r.end}${customer ? ' · selected customer: ' + esc(customer.name) : ''}</div>
        ${customer ? (canRedeem ? `<button class="pri" data-redeem="${esc(r.id)}">Redeem for ${esc(customer.name)}</button>` : `<p class="muted xs">${esc(customer.name)} cannot redeem this reward yet (check points, stock, dates, or personal limit).</p>`) : '<p class="muted xs">Choose a customer first to check redemption eligibility.</p>'}</div></div>`;
    }
    let check = '';
    if (ui.checkRun) {
      const crows = S.personas.map(p => {
        const c = E.checkAll(S, p);
        return `<tr><td>${esc(p.name)}</td><td class="num">${c.all.length}</td><td class="num">${c.elig.length}</td></tr>`;
      }).join('');
      check = `<div class="card" style="margin-top:16px"><div class="card-h"><div><h2>Reward availability check</h2><p class="muted xs">${S.personas.length} customers × ${S.rewards.length} rewards = ${(S.personas.length * S.rewards.length).toLocaleString('en-US')} eligibility checks. Rewards are browsed by customers; none is recommended.</p></div></div><div class="tbl" style="border:0;border-radius:0"><table><thead><tr><th>Customer</th><th class="num">Checks</th><th class="num">Eligible to browse</th></tr></thead><tbody>${crows}</tbody></table></div></div>`;
    }
    return head('Rewards', 'A points catalog the customer browses and chooses from. Rewards are not suggested after a payment.', `<button id="checkBtn">Check availability</button><button class="pri" id="addRewBtn">+ Add reward</button>`) +
      `<details class="help"><summary>Reward redemption and settlement</summary><ol>
        <li>Points are earned only from eligible payments and held as a customer points balance.</li>
        <li>Customers browse rewards they can afford and choose one themselves.</li>
        <li>At redemption, the system reserves or deducts points and records the hotel's or other provider's contracted fulfillment payout.</li>
        <li>IME's gross reward spread is points value redeemed minus provider payout. To keep the reward from losing money, payout must be lower than points value; partner terms must be entered before settlement is treated as real.</li>
        <li>Tax, operating expenses, and final net result still depend on agreed partner terms.</li></ol></details>
      ${det}<div class="tbl"><table><thead><tr><th>Reward</th><th>Provider</th><th class="num">Points</th><th class="num">In stock</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>${check}`;
  }
  function openRew() {
    $('rLink').innerHTML = Object.keys(D.BIZ).map(k => `<option value="${k}">${esc(D.BIZ[k].name)}</option>`).join('');
    $('rCat').innerHTML = Object.keys(D.CAT).map(k => `<option value="${k}">${esc(D.CAT[k].l)}</option>`).join('');
    $('rwForm').reset();
    $('rLimit').value = '2'; $('rStatus').value = 'active';
    $('rStart').value = D.TODAY; $('rEnd').value = '2026-12-31';
    $('rErr').textContent = '';
    calcRew();
    $('rwDlg').showModal();
    $('rName').focus();
  }
  function rewVals() {
    const n = id => { const v = String($(id).value).replace(/[,\s]/g, ''); return v === '' ? NaN : Number(v); };
    return { value:n('rValue'), cost:n('rCost'), stock:n('rStock'), limit:n('rLimit') };
  }
  function calcRew() {
    const v = rewVals();
    const spread = isFinite(v.cost) && isFinite(v.value) ? npr(v.value - v.cost) : '-';
    $('rCalc').innerHTML = `Gross spread to IME <b>${spread}</b> · Points needed <b>${v.value > 0 ? Math.round(v.value / S.cfg.pv) : '-'}</b>`;
  }
  function saveRew(e) {
    e.preventDefault();
    const v = rewVals();
    const name = $('rName').value.trim(), issuer = $('rIssuer').value.trim(), start = $('rStart').value, end = $('rEnd').value;
    let err = '';
    if (!name) err = 'Give the reward a name.';
    else if (!issuer) err = 'Enter the issuer name.';
    else if (!(v.value > 0) || !Number.isInteger(v.value)) err = 'Customer value must be a whole NPR amount above 0.';
    else if (!(v.cost >= 0) || !Number.isInteger(v.cost)) err = 'Actual cost must be a whole NPR amount, 0 or more.';
    else if (v.cost >= v.value) err = 'Provider payout must be lower than points value so IME retains a positive gross spread.';
    else if (!(v.stock >= 1) || !Number.isInteger(v.stock)) err = 'Stock must be a whole number of at least 1.';
    else if (!(v.limit >= 1) || !Number.isInteger(v.limit)) err = 'Limit per customer must be a whole number of at least 1.';
    else if (!start || !end || end < start) err = 'Choose a start date and an end date that is not before it.';
    if (err) { $('rErr').textContent = err; return; }
    const id = 'RW-' + String(S.rewards.length + 1).padStart(3, '0');
    S.rewards.push({ id, name, desc:$('rDesc').value.trim(), type:$('rType').value, issuer, link:$('rLink').value, cat:$('rCat').value,
      value:v.value, cost:v.cost, main:0, stock:v.stock, issued:0, limit:v.limit, start, end, status:$('rStatus').value, custom:true });
    save(); $('rwDlg').close();
    ui.rid = id; ui.tab = 'rewards'; render();
    toast('Reward added. It is now checked for every customer.');
  }

  /* ---------- points ---------- */
  function pointsHTML() {
    const c = S.cfg, tot = {};
    S.personas.forEach(p => p.tx.forEach(t => { tot[t.biz] = (tot[t.biz] || 0) + E.ptsOf(S, t); }));
    const ex = 5000 * D.BIZ.mymart.margin * c.share;
    const tierRows = c.tiers.map((t, i) => {
      const range = i === 0 ? `Up to ${npr(t.max)}` : t.max == null ? `Above ${npr(c.tiers[i - 1].max)}` : `${npr(c.tiers[i - 1].max + 1)}–${npr(t.max)}`;
      return `<tr><td><span class="tier-chip ${t.id}">${esc(t.name)}</span></td><td>${range}</td><td class="num"><b>${t.multiplier}×</b></td><td class="num">${(c.share * t.multiplier * 100).toFixed(0)}% of business margin</td></tr>`;
    }).join('');
    const rows = Object.keys(D.BIZ).map(b => {
      const categories = Object.values(D.CAT).filter(x => x.b === b).map(x => x.l).join(', ');
      return `<tr><td style="font-weight:500">${esc(D.BIZ[b].name)}<div class="sub">Categories: ${esc(categories)}</div></td><td class="num">${(D.BIZ[b].margin * 100).toFixed(1)}%</td><td class="num">${(D.BIZ[b].margin * c.share * 100).toFixed(2)}%</td><td class="num">${(tot[b] || 0).toLocaleString('en-US')}</td><td class="num">${npr((tot[b] || 0) * c.pv)}</td></tr>`;
    }).join('');
    return head('Points') +
      `<div class="card" style="margin-bottom:16px"><div class="card-h"><h2>Settings</h2></div><div class="card-b two">
        <label>Point value (NPR per point)<input type="number" min="0.01" step="0.01" value="${c.pv}" data-cfg="pv"></label>
        <label>Share of margin paid back as cashback (0 to 1)<input type="number" min="0.01" max="1" step="0.01" value="${c.share}" data-cfg="share"></label></div></div>
      <div class="card" style="margin-bottom:16px"><div class="card-h"><div><h2>Customer tiers and points multipliers</h2><p class="muted xs">Tier is based on total recorded purchase spend. A new tier applies to that payment and future payments; past points stay as earned.</p></div></div><div class="tbl" style="border:0;border-radius:0"><table><thead><tr><th>Tier</th><th>Recorded spend</th><th class="num">Multiplier</th><th class="num">Effective margin share</th></tr></thead><tbody>${tierRows}</tbody></table></div><div class="card-b xs muted">Formula: purchase × business margin × ${Math.round(c.share * 100)}% base share × tier multiplier ÷ NPR ${c.pv} per point. Example: at a 6% margin, NPR 10,000 earns NPR 90 / 90 points in Silver, NPR 120 / 120 points in Gold, or NPR 180 / 180 points in Platinum (assuming NPR 1 per point).</div></div>
      <div class="tbl" style="margin-bottom:16px"><table><thead><tr><th>Business and purchase categories</th><th class="num">Margin</th><th class="num">Base cashback rate</th><th class="num">Tier-adjusted points issued</th><th class="num">Liability</th></tr></thead><tbody>${rows}</tbody></table></div>
      <details class="help"><summary>How points work</summary><ol>
        <li>Points are based on purchase amount, that business's margin, the base share, and the customer's tier multiplier.</li>
        <li>Points = cashback value ÷ point value. With 1 point = NPR 1, every point is worth NPR 1.</li>
        <li>Example before tier: NPR 5,000 at MyMart (10% margin) with a 10% share gives NPR ${ex.toFixed(0)} base cashback. Silver then multiplies it by 1.5.</li>
        <li>Customers use points to redeem rewards from the catalog; points are worth the configured NPR value.</li>
        <li>Every unspent point is a liability on the ledger until it is spent.</li></ol></details>`;
  }

  /* ---------- ledger ---------- */
  function ledgerHTML() {
    const tb = E.trial(S), bal = tb.bal;
    const liab = bal['Customer points liability'] || 0;
    const custTotal = S.personas.reduce((s, p) => s + E.balance(S, p), 0) * S.cfg.pv;
    const expense = S.ledger.filter(l => l.account.indexOf('Cashback expense') === 0).reduce((s, l) => s + l.dr, 0);
    const spread = (bal['Reward gross spread income'] || 0) + (bal['Reward spread income'] || 0);
    const payable = (bal['Reward provider payable'] || 0) + (bal['Reward cost, main company'] || 0) + (bal['Reward cost, vendor or partner payable'] || 0);
    const offerRevenue = bal['Offer commission revenue'] || 0;
    const lines = S.ledger.slice(-60).reverse();
    const sets = S.settlements.slice(0, 30).map(s => `<tr><td>${s.id}</td><td>${s.date}</td><td>${esc(s.customer)}</td><td>${esc(s.reward)}<div class="sub">${esc(s.type)} · ${esc(s.issuer)}</div></td><td class="num">${npr(s.value)}</td><td class="num">${npr(s.cost)}</td><td class="num">${npr(s.spread)}</td><td><span class="badge">${esc(s.status)}</span></td></tr>`).join('');
    return head('Ledger') +
      `<div class="grid" style="margin-bottom:16px">
        ${stat('Customer points liability', npr(liab), 'Owed to customers in points')}
        ${stat('Cashback expense', npr(expense), 'Posted to date')}
        ${stat('Reward gross spread', npr(spread), 'Points value minus provider payout')}
        ${stat('Offer commission earned', npr(offerRevenue), 'Confirmed partner coupon uses')}
        ${stat('Partner commission receivable', npr(bal['Partner commission receivable'] || 0), 'Earned and owed by partners')}
        ${stat('Reward provider payable', npr(payable), 'Contracted fulfillment cost')}
        ${stat('Trial balance', tb.balanced ? 'Balanced' : 'Not balanced', 'Debits ' + npr(tb.dr) + ' · credits ' + npr(tb.cr), true)}
        ${stat('Customer balances', Math.abs(custTotal - liab) < 1 ? 'Match' : 'Differ', 'Customers hold ' + npr(custTotal), true)}
      </div>
      <details class="help"><summary>How the ledger works</summary><ol>
        <li>Every money movement is a journal entry. Total debits must equal total credits, or the entry is rejected.</li>
        <li>A purchase posts: debit cashback expense, credit customer points liability.</li>
        <li>A reward redemption posts: debit points liability, credit provider payable and IME gross spread income. Redemption is blocked unless the provider payout is below points value.</li>
        <li>Amounts are fixed when posted, so changing the point value later does not rewrite history.</li></ol></details>
      <h3>Journal, latest 60 lines</h3>
      <div class="tbl" style="margin-bottom:20px"><table><thead><tr><th>Entry</th><th>Date</th><th>Reference</th><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>
        ${lines.map(l => `<tr><td>${l.je}</td><td>${l.date}</td><td class="muted">${esc(l.ref)}</td><td>${esc(l.account)}</td><td class="num">${l.dr ? npr(l.dr) : ''}</td><td class="num">${l.cr ? npr(l.cr) : ''}</td></tr>`).join('')}</tbody></table></div>
      <h3>Settlement register</h3>
      ${S.settlements.length ? `<div class="tbl"><table><thead><tr><th>ID</th><th>Date</th><th>Customer</th><th>Reward and provider</th><th class="num">Points value</th><th class="num">Provider payout</th><th class="num">IME gross spread</th><th>Status</th></tr></thead><tbody>${sets}</tbody></table></div>` : '<p class="muted">No rewards redeemed yet. A redemption records the points value, provider payout, and IME gross spread.</p>'}`;
  }

  /* ---------- client context ---------- */
  const CONTEXT_QUESTIONS = [
    'Explain the IME Loyalty system in simple steps, from payment to points and offers.',
    'How are points calculated from purchase category, business margin, base share, and customer tier? Show an NPR 10,000 example.',
    'What is the difference between an offer and a reward in this system?',
    'How does IME Loyalty earn commission when a customer uses a partner offer code?',
    'What happens when a customer chooses a reward and redeems points?',
    'Explain points value, provider payout, and IME gross spread with a simple settlement example.',
    'What do Capture, Validate, Identify, Ledger Write, Cashback Points, Offer Check, Rewards Check, and Payment Screen mean?',
    'Which parts are simulated in this demo, and what partner or wallet integrations would be needed for a live service?'
  ];
  function clientContextText() {
    return [
      'I am reviewing a demonstration web app called IME Loyalty. Please use this context to answer my questions in clear, plain English. Explain unfamiliar finance terms simply, show calculations step by step, and clearly distinguish demo assumptions from real-world agreements or integrations.',
      '',
      'WHAT THE SYSTEM DOES',
      'IME Loyalty is a loyalty program demo for purchases across IME businesses and partner merchants. A staff user chooses a customer, records a purchase category, amount, date, and merchant, and processes it. The purchase flow shows capture, validation, customer identification, ledger posting, points calculation, offer matching, rewards eligibility, and the customer payment preview. The demo customer names and transactions are fictional.',
      '',
      'HOW POINTS ARE CALCULATED',
      'The business linked to the purchase category has a margin rate. The demo currently shares 10% of that margin as the base cashback amount. Customer tier multiplies the base amount: Silver is 1.5×, Gold is 2×, and Platinum is 3×. Points = purchase amount × business margin × 10% base share × tier multiplier ÷ point value. The point value is currently NPR 1 per point. The tier is based on total recorded purchase spend: Silver through NPR 10,000; Gold from NPR 10,001 through NPR 50,000; Platinum above NPR 50,000. If a purchase crosses a tier threshold, that purchase uses the new tier multiplier. Previously earned transaction points stay as earned.',
      '',
      'OFFERS AND REWARDS ARE DIFFERENT',
      'An offer is an optional coupon shown after a matching eligible purchase. It is not bought with points, and using it does not earn the customer points. IME records partner commission only after partner coupon use is reported and an agreed commission rate is entered. A reward is a separate catalog item the customer can browse and redeem with points. The system does not automatically recommend a reward after payment.',
      '',
      'REWARD SETTLEMENT',
      'When a customer redeems a reward, the demo compares the NPR value represented by the points used with the provider payout agreed for fulfilling the reward. IME gross spread = points value − provider payout. The demo blocks redemption when that spread is zero or negative. Gross spread is before operating costs, tax, and other charges; real partner payout and settlement depend on signed commercial terms.',
      '',
      'WHAT IS AND IS NOT LIVE',
      'This is a browser-based simulation. “Save and process” records a demo transaction and shows a simulated paid confirmation; it does not move real money or contact a real wallet. Coupon use is manually recorded in the demo. Real payments, partner reporting, commission collection, and fulfillment require integrations and commercial agreements.',
      '',
      'QUESTIONS YOU CAN ASK',
      ...CONTEXT_QUESTIONS.map(q => '• ' + q)
    ].join('\n');
  }
  function contextHTML() {
    const context = clientContextText();
    return head('Context', 'Copy this guide and paste it into ChatGPT or another AI assistant to discuss how IME Loyalty works.', '<button class="pri" id="copyContext">Copy full context</button>') +
      `<div class="context-grid"><section class="card context-card"><div class="card-h"><div><h2>Client conversation context</h2><p class="muted xs">Paste this into ChatGPT, then ask a question or use one of the prompts beside it.</p></div></div><div class="card-b"><textarea id="clientContext" class="context-text" readonly rows="24" aria-label="Copyable IME Loyalty explanation">${esc(context)}</textarea><div class="cta" style="margin-top:10px"><button class="pri" id="copyContextInline">Copy context</button><button class="ghost" id="selectContext">Select all text</button></div></div></section>
      <section class="card context-card"><div class="card-h"><div><h2>Questions to ask</h2><p class="muted xs">Click a question to copy it, then paste it after the context.</p></div></div><div class="context-questions">${CONTEXT_QUESTIONS.map((q, i) => `<button class="question-copy" data-copy-question="${i}"><span>${i + 1}</span><b>${esc(q)}</b><small>Copy question</small></button>`).join('')}</div></section></div>`;
  }
  async function copyText(text, success) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const box = document.createElement('textarea'); box.value = text; box.style.position = 'fixed'; box.style.opacity = '0';
        document.body.appendChild(box); box.select(); const ok = document.execCommand('copy'); box.remove();
        if (!ok) throw new Error('Copy command was not available.');
      }
      toast(success);
    } catch (err) { toast('Copy was blocked. Select the text and copy it manually.'); }
  }

  /* ---------- render and events ---------- */
  function render() {
    document.querySelectorAll('nav [data-go]').forEach(b => { if (b.dataset.go === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $('crumb').textContent = TABS[ui.tab];
    $('view').innerHTML = ui.tab === 'offers' ? offersHTML() : ui.tab === 'rewards' ? rewardsHTML() : ui.tab === 'points' ? pointsHTML() : ui.tab === 'ledger' ? ledgerHTML() : ui.tab === 'context' ? contextHTML() : customersHTML();
    $('resetBtn').textContent = ui.confirmReset ? 'Click again to reset everything' : 'Reset demo data';
  }
  function go(tab) {
    if (tab !== ui.tab) { ui.runId++; ui.animating = false; }
    ui.tab = tab; document.body.classList.remove('nav-open');
    try { history.replaceState(null, '', '#' + tab); } catch (e) { /* file preview */ }
    render(); window.scrollTo({ top:0 });
  }
  function step(s) { ui.step = s; render(); window.scrollTo({ top:0 }); }
  function pickPerson(id) { ui.pid = id; ui.previewPid = id; step('customer'); }

  function refreshPeopleList() {
    const q = ui.q.trim().toLowerCase();
    const total = S.personas.filter(p => !q || (p.name + ' ' + p.city + ' ' + p.seg + ' ' + p.id).toLowerCase().includes(q)).length;
    const maxPage = Math.max(0, Math.ceil(total / 3) - 1);
    ui.peoplePage = Math.min(ui.peoplePage, maxPage);
    if ($('peopleGrid')) $('peopleGrid').innerHTML = peopleCardsHTML();
    if ($('peoplePagination')) $('peoplePagination').innerHTML = peoplePageHTML(total);
  }
  function changePeoplePage(delta) { ui.peoplePage += delta; refreshPeopleList(); }

  document.addEventListener('click', e => {
    const row = e.target.closest('.person-card[data-person],tr[data-reward]');
    if (row && !e.target.closest('button')) {
      if (row.dataset.person) pickPerson(row.dataset.person); else { ui.rid = row.dataset.reward; render(); }
      return;
    }
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'copyContext' || t.id === 'copyContextInline') { copyText($('clientContext').value, 'Context copied. Paste it into ChatGPT, then ask a question.'); return; }
    if (t.id === 'selectContext') { $('clientContext').focus(); $('clientContext').select(); toast('Context selected. Copy it and paste it into ChatGPT.'); return; }
    if (t.dataset.copyQuestion != null) { copyText(CONTEXT_QUESTIONS[+t.dataset.copyQuestion], 'Question copied. Paste it after the context.'); return; }
    if (t.hasAttribute('data-dismiss-promo')) { ui.promoDismissed = true; render(); return; }
    if (t.dataset.phoneTab) {
      ui.previewTab = t.dataset.phoneTab;
      if (ui.previewTab === 'rewards' && S.flow && ui.pid === S.flow.pid) ui.step = 'reward';
      render();
      return;
    }
    if (t.dataset.redeem) {
      const p = ui.pid && byId(ui.pid), r = S.rewards.find(x => x.id === t.dataset.redeem);
      if (!p || !r) { toast('Choose a customer and reward first.'); return; }
      const terms = E.settlementFor(S, r);
      if (!window.confirm(`Redeem ${r.name} for ${p.name}?\n\n${E.ptsReq(S, r)} points used.\nProvider payout: ${npr(terms.cost)}\nIME gross spread: ${npr(terms.spread)}.`)) return;
      const result = E.approve(S, { pid:p.id, rid:r.id, txId:'RD-' + Date.now().toString(36), approved:false });
      if (result.error) { toast(result.error); return; }
      save(); render(); toast('Reward redeemed. Provider payout and IME gross spread recorded.'); return;
    }
    if (t.dataset.go) { go(t.dataset.go); return; }
    if (t.dataset.closeReward) { ui.rid = null; render(); return; }
    switch (t.id) {
      case 'menuBtn': document.body.classList.toggle('nav-open'); return;
      case 'peoplePrev': changePeoplePage(-1); return;
      case 'peopleNext': changePeoplePage(1); return;
      case 'backPick': case 'newOne': ui.runId++; ui.animating = false; ui.pid = null; step('pick'); return;
      case 'addTx': openTx(); return;
      case 'txCancel': $('txDlg').close(); return;
      case 'rCancel': $('rwDlg').close(); return;
      case 'skipBtn': ui.skip = true; return;
      case 'replayBtn': runFlow(); return;
      case 'toReward': ui.previewTab = 'rewards'; step('reward'); return;
      case 'backFlow': ui.previewTab = 'home'; step('flow'); return;
      case 'approveBtn': doApprove(); return;
      case 'checkBtn': ui.checkRun = true; render(); return;
      case 'addRewBtn': openRew(); return;
      case 'resetBtn':
        if (!ui.confirmReset) { ui.confirmReset = true; render(); return; }
        ui.confirmReset = false; S = fresh(); ui.pid = null; ui.rid = null; ui.checkRun = false; ui.runId++; ui.animating = false; ui.step = 'pick'; ui.tab = 'customers';
        render(); toast('Demo data restored.');
        return;
    }
  });
  document.addEventListener('click', e => { if (document.body.classList.contains('nav-open') && !e.target.closest('aside,#menuBtn')) document.body.classList.remove('nav-open'); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const row = e.target.closest && e.target.closest('.person-card[data-person],tr[data-reward]');
    if (row) row.click();
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'txAmt') calcTx();
    if (['rValue', 'rCost'].includes(e.target.id)) calcRew();
    if (e.target.id === 'search') { ui.q = e.target.value; ui.peoplePage = 0; refreshPeopleList(); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'txCat') { calcTx(); return; }
    const k = e.target.dataset.cfg; if (!k) return;
    const v = +e.target.value;
    if (!(v > 0) || (k === 'share' && v > 1)) { toast('Enter a valid number.'); render(); return; }
    S.cfg[k] = v; save(); render(); toast('Points recalculated for every customer.');
  });
  $('txForm').addEventListener('submit', saveTx);
  $('rwForm').addEventListener('submit', saveRew);
  document.addEventListener('submit', e => {
    if (!e.target) return;
    if (e.target.id === 'offerUseForm') saveOfferUse(e);
    if (e.target.id === 'offerTermsForm') saveOfferTerms(e);
  });

  /* ---------- start ---------- */
  S = load() || fresh();
  let migratedTierData = false;
  if (!S.cfg.tiers) { S.cfg.tiers = E.DEFAULT_TIERS.map(t => ({...t})); migratedTierData = true; }
  S.personas.forEach(p => p.tx.forEach(t => {
    if (t.tierMultiplier == null) { t.tierName = 'Legacy'; t.tierMultiplier = 1; migratedTierData = true; }
  }));
  if (S.flow && S.flow.tierMultiplier == null) { S.flow.tierName = 'Legacy'; S.flow.tierMultiplier = 1; migratedTierData = true; }
  if (migratedTierData) save();
  if (!S.offers) { S.offers = D.makeOffers(); save(); }
  if (!S.offerRedemptions) S.offerRedemptions = [];
  const h = location.hash.slice(1);
  if (TABS[h]) ui.tab = h;
  render();
})();

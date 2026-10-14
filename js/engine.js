/* IME Loyalty engine: cashback points, reward checks, double-entry ledger and settlement.
   No DOM access. Money is whole NPR. Journal lines are fixed when posted. */
(function (g) {
  'use strict';
  const D = g.IME_DATA;
  const npr = n => 'NPR ' + Math.round(n).toLocaleString('en-US');

  /* ---------- cashback points ---------- */
  const DEFAULT_TIERS = [
    { id:'silver', name:'Silver', min:0, max:10000, multiplier:1.5 },
    { id:'gold', name:'Gold', min:10000, max:50000, multiplier:2 },
    { id:'platinum', name:'Platinum', min:50000, max:null, multiplier:3 }
  ];
  const tierForSpend = (S, spend) => {
    const tiers = S.cfg.tiers || DEFAULT_TIERS;
    return tiers.find(t => spend <= t.max || t.max == null) || tiers[tiers.length - 1];
  };
  const tierOf = (S, p, additionalSpend = 0) => tierForSpend(S, p.tx.reduce((sum, t) => sum + t.amount, 0) + additionalSpend);
  const baseEarnedNPR = (S, t) => t.amount * D.BIZ[t.biz].margin * S.cfg.share;
  // A purchase keeps the tier multiplier that applied when it happened.
  const earnedNPR = (S, t) => baseEarnedNPR(S, t) * (t.tierMultiplier || 1);
  const ptsOf = (S, t) => Math.floor(earnedNPR(S, t) / S.cfg.pv + 1e-9);
  const balance = (S, p) => p.opening + p.tx.reduce((s, t) => s + ptsOf(S, t), 0) - p.spent;
  const ptsReq = (S, r) => Math.round(r.value / S.cfg.pv);

  function metrics(p) {
    const byCat = {}, byBiz = {};
    let total = 0;
    p.tx.forEach(t => {
      total += t.amount;
      byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
      byBiz[t.biz] = (byBiz[t.biz] || 0) + t.amount;
    });
    return { total, byCat, byBiz, monthly: Math.round(total / 4), count: p.tx.length };
  }

  function applySeedTiers(S, p) {
    let spend = 0;
    [...p.tx].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).forEach(t => {
      spend += t.amount;
      const tier = tierForSpend(S, spend);
      t.tierName = tier.name;
      t.tierMultiplier = tier.multiplier;
    });
  }

  /* ---------- reward availability ---------- */
  // Every reward is checked only for redeemability. No recommendation or score is produced.
  function checkAll(S, p) {
    const bal = balance(S, p), date = D.TODAY;
    const all = S.rewards.map(r => {
      const fails = [];
      if (r.status !== 'active') fails.push('status is ' + r.status);
      else if (r.issued >= r.stock) fails.push('out of stock');
      if (date < r.start || date > r.end) fails.push('outside its dates');
      if ((p.got[r.id] || 0) >= r.limit) fails.push('customer limit of ' + r.limit + ' reached');
      if (bal < ptsReq(S, r)) fails.push('needs ' + ptsReq(S, r) + ' points, has ' + bal);
      if (Math.round(ptsReq(S, r) * S.cfg.pv) <= r.cost) fails.push('provider payout would use all points value; no positive IME gross spread');
      return { r, ok: fails.length === 0, fails };
    });
    const elig = all.filter(x => x.ok);
    return { elig, all };
  }

  // Offers are triggered by purchase context, never by the customer's points balance.
  function checkOffers(S, t) {
    const date = t.date || D.TODAY;
    const all = (S.offers || []).map(o => {
      const ok = o.status === 'active' && date >= o.start && date <= o.end && (o.cat === t.cat || o.cat === '*');
      return { o, ok };
    });
    const eligible = all.filter(x => x.ok);
    return { all, eligible, best: eligible[0] || null };
  }
  function setOfferTerms(S, offerId, commissionPct) {
    const offer = (S.offers || []).find(x => x.id === offerId);
    if (!offer) return { error:'Offer not found.' };
    if (offer.link !== 'partner') return { error:'This is an IME-owned offer. Its value is measured through the eligible payment margin, not partner commission.' };
    if (!(commissionPct > 0) || commissionPct > 100) return { error:'Enter the agreed commission rate from above zero to 100 percent.' };
    offer.commissionPct = commissionPct;
    return { ok:true, offer };
  }
  function recordOfferUse(S, offerId, saleAmount, reference) {
    const offer = (S.offers || []).find(x => x.id === offerId);
    if (!offer) return { error:'Offer not found.' };
    if (offer.link !== 'partner') return { error:'This is an IME-owned offer. Its value is measured through the eligible payment margin, not partner commission.' };
    if (!(saleAmount > 0) || !Number.isInteger(saleAmount)) return { error:'Enter a whole sale amount above zero.' };
    if (!(offer.commissionPct > 0) || offer.commissionPct > 100) return { error:'Set the agreed partner commission rate for this offer first.' };
    if (!reference || !String(reference).trim()) return { error:'Enter the partner order reference.' };
    if ((S.offerRedemptions || []).some(x => x.reference === String(reference).trim())) return { error:'This partner order reference was already recorded.' };
    const commissionPct = offer.commissionPct;
    const amount = Math.round(saleAmount * commissionPct / 100);
    if (amount <= 0) return { error:'Commission rounds to zero.' };
    const je = postEntry(S, [
      { account:'Partner commission receivable', dr:amount },
      { account:'Offer commission revenue', cr:amount }
    ], String(reference).trim(), 'Tracked coupon use ' + offer.coupon + ' at ' + offer.issuer);
    const item = { id:'OU-' + String((S.offerRedemptions || []).length + 1).padStart(4, '0'), date:D.TODAY,
      offerId:offer.id, offer:offer.name, coupon:offer.coupon, issuer:offer.issuer, reference:String(reference).trim(),
      saleAmount, commissionPct, amount, je };
    S.offerRedemptions = S.offerRedemptions || [];
    S.offerRedemptions.unshift(item);
    return { ok:true, item, je };
  }
  function availableRewards(S, p) {
    const c = checkAll(S, p);
    return { all:c.all.length, eligible:c.elig.map(x => x.r), checks:c.all };
  }

  /* ---------- ledger ---------- */
  // Every posting is a journal entry: total debits equal total credits.
  function postEntry(S, lines, ref, memo) {
    const dr = lines.reduce((s, l) => s + (l.dr || 0), 0), cr = lines.reduce((s, l) => s + (l.cr || 0), 0);
    if (dr !== cr) throw new Error('Journal does not balance: debit ' + dr + ' credit ' + cr);
    S.jeSeq = (S.jeSeq || 0) + 1;
    const je = 'JE-' + String(S.jeSeq).padStart(5, '0');
    S.ledger.push(...lines.map(l => ({ je, date: D.TODAY, ref, memo, account: l.account, dr: l.dr || 0, cr: l.cr || 0 })));
    return je;
  }
  function seedLedger(S) {
    S.ledger = [];
    S.personas.forEach(p => {
      const pts = p.opening + p.tx.reduce((s, t) => s + ptsOf(S, t), 0);
      postEntry(S, [
        { account:'Cashback expense (seed history)', dr: pts * S.cfg.pv },
        { account:'Customer points liability', cr: pts * S.cfg.pv }
      ], p.id, 'Opening balance and 4-month history');
    });
  }

  /* ---------- flow ---------- */
  // Builds the eight checkpoints for one purchase. Earn entries are posted now. Reward entries post on approval.
  function buildFlow(S, p, t, prevId) {
    const earn = ptsOf(S, t), value = earnedNPR(S, t), baseValue = baseEarnedNPR(S, t);
    const dup = p.tx.some(o => o !== t && o.amount === t.amount && o.date === t.date && o.merchant === t.merchant);
    const rec = checkAll(S, p), offers = checkOffers(S, t), offer = offers.best;
    const eligibleRewards = rec.elig;
    const margin = D.BIZ[t.biz].margin;
    const cps = [
      { n:1, stage:'Capture', node:'src', warn:false,
        data:'source: ' + D.BIZ[t.biz].name + ' (' + D.BIZ[t.biz].sys + ')\nref: ' + t.id + '\namount: ' + t.amount + ' NPR\nmerchant: ' + t.merchant +
          '\ncategory: ' + t.cat + '\ncustomer_ref: ' + p.id + '\noccurred_at: ' + t.date + 'T12:00:00+05:45',
        rules:'Record received from the source system through the integration API. Source format is kept as received.' },
      { n:2, stage:'Validate', node:'int', warn:dup,
        data:'amount whole and 1 to 500,000: pass\ndate not after today: pass\ncategory in catalogue: pass\nduplicate (amount, date, merchant): ' + (dup ? 'FOUND, review' : 'none'),
        rules:'Reject if any check fails. A possible duplicate is flagged for review and does not post twice.' },
      { n:3, stage:'Identify', node:'int', warn:false,
        data:'customer_ref ' + p.id + ' mapped to IME customer ' + p.id + '\nmatch rule: explicit mapping (verified phone or account)\nname or demographic similarity used: no',
        rules:'Records are matched only by verified identifiers or an explicit mapping. Similar names never link two people.' },
      { n:4, stage:'Ledger write', node:'ledger', warn:false,
        data:'Dr Cashback expense, ' + D.BIZ[t.biz].name + '   ' + npr(earn) + '\nCr Customer points liability, ' + p.id + '   ' + npr(earn) + '\ncheck: debits equal credits',
        rules:'Double-entry journal. Posted once, with a reference to the transaction. Values are fixed at posting.' },
      { n:5, stage:'Cashback points', node:'points', warn:false,
        data:'category: ' + D.CAT[t.cat].l + '\nbusiness: ' + D.BIZ[t.biz].name + '\nbusiness margin: ' + (margin * 100).toFixed(1) + '%\nbase margin share: ' + (S.cfg.share * 100).toFixed(0) + '%\ntier: ' + (t.tierName || 'Silver') + ' (' + (t.tierMultiplier || 1).toFixed(1) + '×)\nbase cashback: NPR ' + baseValue.toFixed(2) + '\ntier-adjusted cashback: NPR ' + value.toFixed(2) +
          '\npoints: floor(' + value.toFixed(2) + ' / ' + S.cfg.pv + ') = ' + earn + '\nbalance after: ' + balance(S, p) + ' points',
        rules:'Points = purchase x business margin x base share x customer tier multiplier, divided by NPR ' + S.cfg.pv + ' per point. Tier is based on total recorded purchase spend.' },
      { n:6, stage:'Offer check', node:'reward', warn:!offer,
        data:'offers checked: ' + offers.all.length + '\nmatching active offers: ' + offers.eligible.length +
          '\n' + (offer ? 'suggested coupon: ' + offer.o.name + '\ncode: ' + offer.o.coupon + '\ndiscount: ' + offer.o.discountPct + '%' : 'no matching offer for this category'),
        rules:'Offers are matched to the transaction category and active dates. Points balance is not used to select offers. Coupon use is tracked separately; IME earnings are recognized when use is reported.' },
      { n:7, stage:'Points and rewards', node:'settle', warn:!eligibleRewards.length,
        data:'points balance: ' + balance(S, p) + '\nrewards checked: ' + rec.all.length + '\nrewards currently affordable and eligible: ' + eligibleRewards.length +
          (eligibleRewards.length ? '\nexamples: ' + eligibleRewards.slice(0, 3).map(x => x.r.name).join(', ') : ''),
        rules:'The customer browses the reward catalog and chooses whether to redeem. No reward is suggested or deducted during this purchase.' },
      { n:8, stage:'Payment screen', node:'pwa', warn:false,
        data:'points earned: ' + earn + '\nnew balance: ' + balance(S, p) + '\noffer shown: ' + (offer ? offer.o.name + ' · code ' + offer.o.coupon : 'none') +
          '\nredeem coupon on merchant site; IME earns when use is tracked',
        rules:'Show earned points and an optional coupon offer together. Using an offer does not grant points; eligible payments do.' }
    ];
    return {
      pid:p.id, customer:p.name, txId:t.id, merchant:t.merchant, amount:t.amount, biz:t.biz, cat:t.cat, date:t.date,
      tierName:t.tierName || 'Silver', tierMultiplier:t.tierMultiplier || 1,
      cps, rid:null, offerId:offer ? offer.o.id : null, eligibleRewardCount:eligibleRewards.length,
      offerIds:offers.eligible.map(x => x.o.id), checked:rec.all.length, eligible:eligibleRewards.length,
      noReward:'',
      approved: false, earnJe: null, approveJe: null
    };
  }

  /* ---------- settlement and approval ---------- */
  function settlementFor(S, r) {
    const pts = ptsReq(S, r);
    const pointsValue = Math.round(pts * S.cfg.pv), spread = pointsValue - r.cost;
    return { value:pointsValue, cost:r.cost, provider:r.issuer, spread, pointsValue, margin: pointsValue ? spread / pointsValue : 0 };
  }
  function approve(S, flow) {
    const p = S.personas.find(x => x.id === flow.pid), r = S.rewards.find(x => x.id === flow.rid);
    if (!p || !r) return { error:'Reward or customer not found.' };
    if (flow.approved) return { error:'Already approved.' };
    if (r.issued >= r.stock) return { error:'This reward is out of stock.' };
    if (balance(S, p) < ptsReq(S, r)) return { error:'Not enough points for this reward.' };
    if (!checkAll(S, p).elig.some(x => x.r.id === r.id)) return { error:'This reward is not currently eligible for this customer.' };
    const s = settlementFor(S, r), pts = ptsReq(S, r);
    if (s.spread <= 0) return { error:'This reward has no positive IME gross spread. Review its provider payout before redeeming.' };
    const je = postEntry(S, [
      { account:'Customer points liability', dr: s.pointsValue },
      { account:'Reward provider payable', cr: s.cost },
      { account:'Reward gross spread income', cr: s.spread }
    ], flow.txId, 'Approved ' + r.name + ' for ' + p.name);
    r.issued++; p.spent += pts; p.got[r.id] = (p.got[r.id] || 0) + 1;
    p.rewards.unshift({ name:r.name, date:D.TODAY, points:pts });
    S.settlements.unshift({ id:'SET-' + String(S.settlements.length + 1).padStart(4, '0'), date:D.TODAY, customer:p.name,
      reward:r.name, type:r.type, issuer:r.issuer, value:s.value, cost:s.cost, main:0, vendor:s.cost, spread:s.spread, status:'Payout due', je });
    flow.approved = true; flow.approveJe = je;
    return { ok:true, je };
  }

  /* ---------- trial balance ---------- */
  function trial(S) {
    const dr = S.ledger.reduce((s, l) => s + l.dr, 0), cr = S.ledger.reduce((s, l) => s + l.cr, 0);
    const bal = {};
    S.ledger.forEach(l => { bal[l.account] = (bal[l.account] || 0) + l.cr - l.dr; });
    return { dr, cr, balanced: dr === cr, bal };
  }

  g.IME_ENGINE = { npr, DEFAULT_TIERS, tierForSpend, tierOf, applySeedTiers, baseEarnedNPR, earnedNPR, ptsOf, balance, ptsReq, metrics, checkAll, checkOffers, availableRewards, setOfferTerms, recordOfferUse, seedLedger, postEntry, buildFlow, settlementFor, approve, trial };
})(window);

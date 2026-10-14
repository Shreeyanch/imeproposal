/* Seed data for IME Loyalty. All customers, merchants and rewards are fictional. Money is whole NPR. */
(function (g) {
  'use strict';
  const DAY = 86400000;
  const REF = Date.UTC(2026, 9, 13);
  const TODAY = new Date(REF).toISOString().slice(0, 10);

  /* Businesses in the IME ecosystem. margin = gross margin used to size cashback. */
  const BIZ = {
    khalti:   { name:'Khalti',           sys:'ERP',        margin:0.02, color:'#7c5cd6', icon:'mobile' },
    bank:     { name:'Global Bank',      sys:'LBS',        margin:0.05, color:'#1f8fa3', icon:'banking' },
    dishhome: { name:'DishHome',         sys:'ERP',        margin:0.08, color:'#d9662b', icon:'tv' },
    ila:      { name:'ila',              sys:'Aegis POS',  margin:0.12, color:'#b4497f', icon:'shopping' },
    mymart:   { name:'MyMart',           sys:'ERP',        margin:0.10, color:'#2f9e6e', icon:'groceries' },
    partner:  { name:'Partner merchants',sys:'Partner API',margin:0.06, color:'#b7892a', icon:'hotel' }
  };
  /* What each purchase category belongs to. */
  const CAT = {
    groceries:     { l:'Grocery',            b:'mymart',   m:'MyMart' },
    electricity:   { l:'Electricity bill',   b:'khalti',   m:'NEA electricity' },
    water:         { l:'Water bill',         b:'khalti',   m:'Water supply' },
    mobile:        { l:'Mobile recharge',    b:'khalti',   m:'Mobile recharge' },
    internet:      { l:'Internet bill',      b:'dishhome', m:'DishHome internet' },
    tv:            { l:'TV subscription',    b:'dishhome', m:'DishHome TV' },
    dining:        { l:'Restaurant',         b:'bank',     m:'Restaurant' },
    hotel:         { l:'Hotel',              b:'partner',  m:'Hotel' },
    shopping:      { l:'Shopping',           b:'ila',      m:'ila store' },
    entertainment: { l:'Movies and events',  b:'partner',  m:'Cinema' },
    travel:        { l:'Travel and transport',b:'partner', m:'Transport' },
    banking:       { l:'Banking and wallet', b:'bank',     m:'Wallet and transfers' }
  };
  const ICON = {
    groceries:'<path d="M4 9h16l-2 10H6L4 9z"/><path d="M8 9l3-5M16 9l-3-5"/>',
    electricity:'<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    water:'<path d="M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12z"/>',
    mobile:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    internet:'<path d="M2 9a15 15 0 0 1 20 0"/><path d="M5 13a10 10 0 0 1 14 0"/><circle cx="12" cy="18" r="1.5"/>',
    tv:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
    dining:'<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M16 21V3c-2 1-3 3-3 6h3"/>',
    hotel:'<path d="M3 18V6M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/>',
    shopping:'<path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    entertainment:'<path d="M3 8h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4V8z"/>',
    travel:'<path d="M3 13l18-7-7 18-2-7-9-4z"/>',
    banking:'<path d="M3 10l9-6 9 6M5 10v9M9 10v9M15 10v9M19 10v9M3 19h18"/>'
  };

  /* 20 fictional customers and the spending profile that shapes their history. */
  const PEOPLE = [
    ['Sita Rai','F',1989,'Kathmandu','Baneshwor','Nurse','household'],
    ['Ramesh Thapa','M',1981,'Pokhara','Lakeside','Hotel operations','hospitality'],
    ['Anita Gurung','F',1994,'Pokhara','Mahendrapool','Freelance designer','shopper'],
    ['Bikash Shrestha','M',1978,'Kathmandu','Patan','Civil engineer','family'],
    ['Pooja Karki','F',2001,'Kathmandu','Kirtipur','University student','student'],
    ['Suman Tamang','M',1990,'Chitwan','Bharatpur','Shopkeeper','household'],
    ['Kiran Magar','M',1986,'Biratnagar','Traffic','Logistics coordinator','commuter'],
    ['Nabin Adhikari','M',1999,'Kathmandu','Thamel','Software trainee','student'],
    ['Sabina Joshi','F',1984,'Bhaktapur','Suryabinayak','School teacher','family'],
    ['Dipak Khadka','M',1972,'Pokhara','Bagar','Retired banker','household'],
    ['Rita Basnet','F',1996,'Kathmandu','Lalitpur','Marketing executive','shopper'],
    ['Ujjwal Pandey','M',1992,'Kathmandu','Maharajgunj','Sales manager','hospitality'],
    ['Mina Lama','F',1988,'Chitwan','Narayangarh','Pharmacist','household'],
    ['Roshan Bhandari','M',1997,'Kathmandu','Balaju','Delivery rider','commuter'],
    ['Asmita Sharma','F',1979,'Biratnagar','Bargachi','Business owner','family'],
    ['Sanjay Koirala','M',1983,'Kathmandu','Koteshwor','Bank officer','hospitality'],
    ['Garima Neupane','F',2003,'Pokhara','Prithvi Chowk','Graduate trainee','student'],
    ['Hari Poudel','M',1968,'Bhaktapur','Madhyapur','Farmer and cooperative','household'],
    ['Kabita Ghimire','F',1991,'Kathmandu','Kalanki','Pharmacy assistant','commuter'],
    ['Ashish Acharya','M',1995,'Chitwan','Ratnanagar','Electrician','shopper']
  ];
  /* [category, purchases per month, min NPR, max NPR] */
  const ARCH = {
    household:  [['groceries',4,600,2200],['electricity',1,700,1400],['water',1,250,500],['mobile',1,300,700],['tv',1,900,1500]],
    student:    [['mobile',3,150,500],['dining',3,250,900],['groceries',2,300,800],['entertainment',1,400,900],['banking',1,200,600]],
    hospitality:[['dining',5,800,4200],['hotel',1,3500,9000],['groceries',2,500,1500],['banking',1,300,900],['travel',1,400,1200]],
    family:     [['groceries',5,900,3000],['electricity',1,1200,2600],['internet',1,1100,1800],['tv',1,1200,2000],['shopping',1,1500,5200]],
    shopper:    [['shopping',3,1200,6500],['groceries',2,800,2200],['mobile',1,400,800],['dining',2,600,2000],['entertainment',1,700,1600]],
    commuter:   [['travel',6,150,700],['mobile',2,200,600],['entertainment',2,600,1800],['groceries',2,400,1100],['banking',2,250,700]]
  };
  const ARCH_LABEL = { household:'Household shopper', student:'Student', hospitality:'Dining and travel regular', family:'Family upgrader', shopper:'Brand-led shopper', commuter:'Commuter and events' };

  /* 50 seeded rewards: [name, category, linked business key, customer value NPR, cost to give NPR, stock] */
  const REWARD_ROWS = [
    ['NPR 300 mobile recharge','mobile','khalti',300,285,5000],
    ['NPR 500 wallet cashback','banking','khalti',500,460,3000],
    ['Electricity bill credit NPR 200','electricity','khalti',200,180,4000],
    ['Water bill discount NPR 150','water','khalti',150,135,2500],
    ['Mobile data pack 2 GB','mobile','khalti',250,212,6000],
    ['Utility week saver NPR 400','electricity','khalti',400,372,1500],
    ['Mobile upgrade trade-in credit','mobile','khalti',900,729,200],
    ['Internet and wallet bundle credit','internet','khalti',300,264,1300],
    ['Card dining 10% off up to NPR 300','dining','bank',300,264,3000],
    ['Card hotel stay NPR 1,000 off','hotel','bank',1000,840,800],
    ['Fuel and transport credit NPR 200','travel','bank',200,188,2000],
    ['Transfer fee waiver (5)','banking','bank',250,200,4000],
    ['Card cashback 2%','banking','bank',350,315,6000],
    ['Weekday lunch 15% off','dining','bank',220,200,3500],
    ['Donation to school fund NPR 100','banking','bank',100,95,3000],
    ['TV package upgrade for a month','tv','dishhome',600,528,900],
    ['Internet renewal discount NPR 400','internet','dishhome',400,360,1200],
    ['Free Sports add-on for a month','tv','dishhome',500,400,700],
    ['Set-top box upgrade fee waiver','tv','dishhome',350,301,800],
    ['Renewal bonus: 3 months for the price of 2','internet','dishhome',1000,850,400],
    ['ila fashion voucher NPR 1,000','shopping','ila',1000,780,900],
    ['ila electronics NPR 500 off','shopping','ila',500,410,1100],
    ['ila home essentials 20% off','shopping','ila',400,336,1600],
    ['ila free delivery, three times','shopping','ila',150,138,3000],
    ['Earbuds bundle (NPR 1,900 value)','shopping','ila',1900,1500,250],
    ['Smart watch band NPR 700','shopping','ila',700,581,500],
    ['Power bank and charger set','mobile','ila',450,378,1000],
    ['MyMart grocery voucher NPR 500','groceries','mymart',500,460,3000],
    ['MyMart fresh produce 10% off','groceries','mymart',200,180,4000],
    ['MyMart breakfast bundle','groceries','mymart',350,304,1500],
    ['MyMart beverage multipack','groceries','mymart',180,160,2500],
    ['MyMart household essentials NPR 700','groceries','mymart',700,637,900],
    ['MyMart premium coffee sample','groceries','mymart',120,90,5000],
    ['MyMart milk and butter pair','groceries','mymart',280,255,2200],
    ['Pharmacy and health credit NPR 250','groceries','mymart',250,225,2600],
    ['Partner dining voucher NPR 500','dining','partner',500,450,1200],
    ['Hotel weekend discount 15%','hotel','partner',900,738,600],
    ['Cinema two-ticket offer','entertainment','partner',600,516,1500],
    ['New release movie ticket NPR 350','entertainment','partner',350,315,2500],
    ['Concert early-access voucher','entertainment','partner',1200,1020,300],
    ['Airport transfer voucher','travel','partner',800,704,500],
    ['Bus pass credit NPR 300','travel','partner',300,276,2000],
    ['Hotel breakfast for two','hotel','partner',600,516,700],
    ['Restaurant tasting menu','dining','partner',1500,1245,250],
    ['Weekend getaway credit NPR 2,000','travel','partner',2000,1640,150],
    ['Gym and wellness month','entertainment','partner',800,680,400],
    ['Cinema popcorn combo','entertainment','partner',180,162,4000],
    ['Long-stay hotel, 5 nights','hotel','partner',3000,2400,120],
    ['Kids book voucher NPR 400','shopping','partner',400,352,800],
    ['Shopping coupon NPR 250','shopping','partner',250,215,2000]
  ];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function makePeople() {
    const R = mulberry32(20261013);
    return PEOPLE.map((x, i) => {
      const [name, g, born, city, area, job, arch] = x;
      const tx = [];
      ARCH[arch].forEach(([cat, per, min, max]) => {
        for (let k = 0; k < per * 4; k++) {
          const amount = Math.round((min + R() * (max - min)) / 10) * 10;
          const d = Math.floor(R() * 120);
          tx.push({ id:'T' + i + '-' + tx.length, date:new Date(REF - d * DAY).toISOString().slice(0, 10),
            cat, biz:CAT[cat].b, amount, merchant:CAT[cat].m, src:'history' });
        }
      });
      tx.sort((a, b) => b.date.localeCompare(a.date));
      return { id:'CU-' + (1001 + i), name, g, age:2026 - born, city, area, job, seg:ARCH_LABEL[arch],
        tx, opening:800 + Math.floor(R() * 2200), spent:0, got:{}, rewards:[], lastRec:null };
    });
  }

  function makeRewards() {
    return REWARD_ROWS.map((r, i) => {
      const third = r[2] === 'partner';
      const main = Math.round(r[4] / 3);
      return { id:'RW-' + String(i + 1).padStart(3, '0'), name:r[0], desc:'', type:third ? 'Third-party' : 'Own',
        issuer:third ? 'Partner merchant (fictional)' : BIZ[r[2]].name, link:r[2], cat:r[1],
        value:r[3], cost:r[4], main, stock:r[5], issued:0, limit:2,
        start:'2026-01-01', end:'2026-12-31', status:'active', custom:false };
    });
  }

  // Offers are coupons shown after a payment. Coupon use is tracked separately
  // from points; IME revenue is recognized only when partner redemption is recorded.
  function makeOffers() {
    return REWARD_ROWS.map((r, i) => {
      const business = r[2];
      const pct = [5, 10, 15, 10, 5][i % 5];
      return { id:'OF-' + String(i + 1).padStart(3, '0'), name:r[0].replace(/\s*\d+\s*%\s*(off)?/gi, '').replace(/\([^)]*\)/g, '').trim() + ' offer',
        desc:pct + '% off your next eligible purchase. Show this coupon code at checkout.',
        issuer:business === 'partner' ? 'Partner merchant ' + String(1 + i % 12).padStart(2, '0') : BIZ[business].name,
        link:business, cat:r[1], discountPct:pct, coupon:'IME' + String(i + 1).padStart(3, '0'),
        commissionPct:null, status:'active', start:'2026-01-01', end:'2026-12-31', custom:false };
    });
  }

  g.IME_DATA = { DAY, REF, TODAY, BIZ, CAT, ICON, PEOPLE, ARCH_LABEL, makePeople, makeRewards, makeOffers };
})(window);

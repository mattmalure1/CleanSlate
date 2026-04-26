// ============================================================
// test-profit-ratio.js
// Run 100 mixed media items through the engine and compute the
// customer-offer vs. Matt-profit ratio for each accepted item.
//
// Usage: node test-profit-ratio.js
// Requires SUPABASE_URL + SUPABASE_SERVICE_KEY + KEEPA_API_KEY in .env
// ============================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const keepa = require('./services/keepa');
const engine = require('./services/offerEngine');
const tt = require('./services/tierThresholds');

// Mix of 50 books + 50 DVDs/games for variety
const BARCODES = [
  // ── Books (mix of bestsellers, textbooks, fiction, etc.) ──
  { code: '9780439708180', kind: 'book', name: 'Harry Potter Sorcerer Stone' },
  { code: '9780062316097', kind: 'book', name: 'Sapiens' },
  { code: '9780735219090', kind: 'book', name: 'Where the Crawdads Sing' },
  { code: '9780525559474', kind: 'book', name: 'The Midnight Library' },
  { code: '9780593139134', kind: 'book', name: 'A Promised Land' },
  { code: '9780525536512', kind: 'book', name: 'Daisy Jones & The Six' },
  { code: '9780062316110', kind: 'book', name: 'Becoming' },
  { code: '9780374533557', kind: 'book', name: 'Thinking Fast and Slow' },
  { code: '9780062457714', kind: 'book', name: 'Subtle Art of Not Giving F*ck' },
  { code: '9781501161933', kind: 'book', name: 'Educated' },
  { code: '9780743273565', kind: 'book', name: 'The Great Gatsby' },
  { code: '9780451524935', kind: 'book', name: '1984' },
  { code: '9780061120084', kind: 'book', name: 'To Kill a Mockingbird' },
  { code: '9780316769488', kind: 'book', name: 'Catcher in the Rye' },
  { code: '9780142437179', kind: 'book', name: 'Pride and Prejudice' },
  { code: '9780743273565', kind: 'book', name: 'Gatsby alt' },
  { code: '9780553296983', kind: 'book', name: 'Fahrenheit 451' },
  { code: '9780553573404', kind: 'book', name: 'Game of Thrones' },
  { code: '9780553381689', kind: 'book', name: 'Game of Thrones series' },
  { code: '9780316015844', kind: 'book', name: 'Twilight' },
  { code: '9780062060624', kind: 'book', name: 'Lord of the Flies' },
  { code: '9780062024039', kind: 'book', name: 'Divergent' },
  { code: '9780439023481', kind: 'book', name: 'Hunger Games' },
  { code: '9780385741873', kind: 'book', name: 'The Fault in Our Stars' },
  { code: '9780062060556', kind: 'book', name: 'Where the Sidewalk Ends' },
  { code: '9780134685991', kind: 'book', name: 'Effective Java textbook' },
  { code: '9780132350884', kind: 'book', name: 'Clean Code textbook' },
  { code: '9780321125217', kind: 'book', name: 'Domain Driven Design' },
  { code: '9780596007126', kind: 'book', name: 'Programming Pearls' },
  { code: '9780131103627', kind: 'book', name: 'C Programming Language' },
  { code: '9780321775658', kind: 'book', name: 'C++ Primer textbook' },
  { code: '9780134093413', kind: 'book', name: 'Computer Networks textbook' },
  { code: '9780134580999', kind: 'book', name: 'Algorithms textbook' },
  { code: '9780073527277', kind: 'book', name: 'Cell Biology textbook' },
  { code: '9780134235264', kind: 'book', name: 'Operating Systems textbook' },
  { code: '9780495011668', kind: 'book', name: 'Calculus textbook' },
  { code: '9780134802749', kind: 'book', name: 'Modern Database Mgmt textbook' },
  { code: '9780471770886', kind: 'book', name: 'Discrete Math textbook' },
  { code: '9780321856715', kind: 'book', name: 'Java textbook' },
  { code: '9780718037017', kind: 'book', name: 'Christian fiction' },
  { code: '9780310329312', kind: 'book', name: 'Bible study book' },
  { code: '9780310283430', kind: 'book', name: 'Religious book' },
  { code: '9780785289043', kind: 'book', name: 'Christian living' },
  { code: '9780307474278', kind: 'book', name: 'Da Vinci Code' },
  { code: '9780385333481', kind: 'book', name: 'Memoirs of a Geisha' },
  { code: '9780060850524', kind: 'book', name: 'Brave New World' },
  { code: '9780140283334', kind: 'book', name: 'On the Road' },
  { code: '9780547928227', kind: 'book', name: 'The Hobbit' },
  { code: '9780544003415', kind: 'book', name: 'Lord of the Rings' },
  { code: '9780618640157', kind: 'book', name: 'LOTR Two Towers' },
  { code: '9780618260249', kind: 'book', name: 'LOTR Return of King' },

  // ── DVDs / Blu-rays ──
  { code: '0786936215595', kind: 'dvd', name: 'Finding Nemo' },
  { code: '0786936233513', kind: 'dvd', name: 'The Incredibles' },
  { code: '0786936244250', kind: 'dvd', name: 'Cars' },
  { code: '0786936292916', kind: 'dvd', name: 'Wall-E' },
  { code: '0786936756401', kind: 'dvd', name: 'Frozen' },
  { code: '0786936842128', kind: 'dvd', name: 'Moana' },
  { code: '0786936862034', kind: 'dvd', name: 'Coco' },
  { code: '0024543213796', kind: 'dvd', name: 'Fight Club' },
  { code: '0024543040651', kind: 'dvd', name: 'Office Space' },
  { code: '0012569593268', kind: 'dvd', name: 'Shawshank Redemption' },
  { code: '0085391163824', kind: 'dvd', name: 'The Matrix' },
  { code: '0085391174028', kind: 'dvd', name: 'Goodfellas' },
  { code: '0012569791374', kind: 'dvd', name: 'Pulp Fiction' },
  { code: '0883929037810', kind: 'dvd', name: 'Dark Knight' },
  { code: '0883929322107', kind: 'dvd', name: 'Inception' },
  { code: '0883929416226', kind: 'dvd', name: 'Interstellar' },
  { code: '0097360719246', kind: 'dvd', name: 'Gladiator' },
  { code: '0032429262585', kind: 'dvd', name: 'Schindlers List' },
  { code: '0025192018626', kind: 'dvd', name: 'Jurassic Park' },
  { code: '0025192112836', kind: 'dvd', name: 'Back to the Future' },
  { code: '0043396514386', kind: 'dvd', name: 'Spider-Man' },
  { code: '0043396242418', kind: 'dvd', name: 'Men in Black' },
  { code: '0883904207016', kind: 'dvd', name: 'Drive' },
  { code: '0826663121155', kind: 'dvd', name: 'Breaking Bad TV' },
  { code: '0883904208389', kind: 'dvd', name: 'The Big Lebowski' },
  // ── CDs ──
  { code: '0602567500322', kind: 'cd', name: 'Adele 21' },
  { code: '0093624898412', kind: 'cd', name: 'Linkin Park CD' },
  { code: '0602527810331', kind: 'cd', name: 'Music CD random' },
  { code: '0602527567686', kind: 'cd', name: 'Music CD 2' },
  { code: '0602567496878', kind: 'cd', name: 'Music CD 3' },
  { code: '0093624877950', kind: 'cd', name: 'Music CD 4' },
  { code: '0093624900788', kind: 'cd', name: 'Music CD 5' },
  { code: '0093624877264', kind: 'cd', name: 'Music CD 6' },
  { code: '0731452800022', kind: 'cd', name: 'Beatles CD' },
  { code: '0094636242422', kind: 'cd', name: 'Beatles 2' },

  // ── Video Games ──
  { code: '0045496903237', kind: 'game', name: 'Mario Switch' },
  { code: '0045496592554', kind: 'game', name: 'Zelda BOTW' },
  { code: '0045496590000', kind: 'game', name: 'Switch game' },
  { code: '0711719541257', kind: 'game', name: 'PS5 Spider-Man' },
  { code: '0711719546764', kind: 'game', name: 'Returnal PS5' },
  { code: '0883929664535', kind: 'game', name: 'Mortal Kombat' },
  { code: '0093155174177', kind: 'game', name: 'Bethesda game' },
  { code: '0014633366822', kind: 'game', name: 'EA game' },
  { code: '0014633731538', kind: 'game', name: 'EA game 2' },
  { code: '0884095171490', kind: 'game', name: 'Capcom game' },
  { code: '0013388410415', kind: 'game', name: 'Capcom 2' },
  { code: '0014633371642', kind: 'game', name: 'EA Sports' },
  { code: '0883929675210', kind: 'game', name: 'Xbox game' },
  { code: '0093155146891', kind: 'game', name: 'Skyrim' },
  { code: '0696055242542', kind: 'game', name: 'Indie game' },
];

const COLOR_RESET = '\x1b[0m';
const C = {
  green: (s) => `\x1b[32m${s}${COLOR_RESET}`,
  amber: (s) => `\x1b[33m${s}${COLOR_RESET}`,
  red:   (s) => `\x1b[31m${s}${COLOR_RESET}`,
  gray:  (s) => `\x1b[90m${s}${COLOR_RESET}`,
  cyan:  (s) => `\x1b[36m${s}${COLOR_RESET}`,
  bold:  (s) => `\x1b[1m${s}${COLOR_RESET}`,
};

function dollars(cents) {
  if (cents == null) return '   - ';
  return '$' + (cents / 100).toFixed(2).padStart(5);
}

async function analyze() {
  await tt.loadThresholds();

  console.log(C.bold(`\nAnalyzing ${BARCODES.length} items through the live engine...\n`));
  console.log(C.gray('  #  Type   Status        Offer   SellPrice  NetResale  ProfitIfFBA  Margin%   Title'));
  console.log(C.gray('  ──────────────────────────────────────────────────────────────────────────────────────'));

  const stats = {
    total: 0, accepted: 0, penny: 0, rejected: 0, error: 0,
    offerSum: 0, profitSum: 0,
    profitableCount: 0, lossCount: 0,
    byCategory: {},
  };

  let i = 0;
  for (const { code, kind, name } of BARCODES) {
    i++;
    try {
      const keepaResp = await keepa.lookupByCode(code, { lean: true });
      if (!keepaResp.products || keepaResp.products.length === 0) {
        stats.error++;
        console.log(`${String(i).padStart(3)}  ${kind.padEnd(5)} ${C.gray('not in Keepa  ')} ${C.gray(name)}`);
        continue;
      }
      const product = keepaResp.products[0];
      const fields = engine.extractKeepaFields(product);
      const gated = engine.isGated(product);
      const result = engine.runOfferEngine(product, fields, { gatedResult: gated });
      const trace = result.calculation_trace || {};

      stats.total++;
      const cat = trace.category || kind;
      if (!stats.byCategory[cat]) stats.byCategory[cat] = { count: 0, accepted: 0, offerSum: 0, profitSum: 0 };
      stats.byCategory[cat].count++;

      if (!result.accepted) {
        stats.rejected++;
        console.log(`${String(i).padStart(3)}  ${kind.padEnd(5)} ${C.red('REJECT       ')} ${C.gray(result.rejection_reason || '?')} — ${C.gray(name)}`);
        continue;
      }

      // Accepted item — calculate profit
      const offerCents = result.offer_cents || 0;
      const sellPrice = trace.working_price_cents || 0;
      const netResale = trace.net_resale_cents || 0;
      const isPenny = result.is_penny_tier;
      // Profit = what Matt makes if he resells via Amazon FBA
      // = working_price - all_fees - offer_paid_to_customer
      const profitIfFBA = netResale - offerCents;

      stats.accepted++;
      if (isPenny) stats.penny++;
      stats.offerSum += offerCents;
      stats.byCategory[cat].accepted++;
      stats.byCategory[cat].offerSum += offerCents;

      // For bundle items, FBA profit doesn't apply (eBay channel instead)
      // but we still compute it for visibility.
      if (!isPenny) {
        stats.profitSum += profitIfFBA;
        stats.byCategory[cat].profitSum += profitIfFBA;
        if (profitIfFBA > 0) stats.profitableCount++;
        else stats.lossCount++;
      }

      const margin = sellPrice > 0 ? ((profitIfFBA / sellPrice) * 100).toFixed(0) + '%' : '   -';
      const colorize = isPenny ? C.amber : (profitIfFBA > 0 ? C.green : C.red);
      const statusLabel = isPenny ? 'BUNDLE       ' : 'STANDARD     ';
      console.log(
        `${String(i).padStart(3)}  ${kind.padEnd(5)} ${colorize(statusLabel)}` +
        ` ${dollars(offerCents)}  ${dollars(sellPrice)}  ${dollars(netResale)}  ${dollars(profitIfFBA)}  ${margin.padStart(7)}   ${C.gray(name)}`
      );
    } catch (err) {
      stats.error++;
      console.log(`${String(i).padStart(3)}  ${kind.padEnd(5)} ${C.red('ERROR        ')} ${C.gray(err.message.slice(0, 60))} ${C.gray(name)}`);
    }
    // Tiny pause to be nice to Keepa
    await new Promise(r => setTimeout(r, 50));
  }

  // ── Summary ──────────────────────────────────────────────
  console.log('\n' + C.bold('══════════════ SUMMARY ══════════════\n'));
  console.log(`Total tested:          ${stats.total}`);
  console.log(`Accepted (any tier):   ${C.green(stats.accepted)} (${(stats.accepted / stats.total * 100).toFixed(1)}%)`);
  console.log(`  Standard:            ${stats.accepted - stats.penny}`);
  console.log(`  Bundle (10¢):        ${stats.penny}`);
  console.log(`Rejected:              ${C.red(stats.rejected)} (${(stats.rejected / stats.total * 100).toFixed(1)}%)`);
  console.log(`Errors:                ${stats.error}`);

  console.log('\n' + C.bold('── Standard-tier economics (FBA path) ──'));
  console.log(`Items in standard tier:  ${stats.accepted - stats.penny}`);
  if (stats.accepted - stats.penny > 0) {
    const stdCount = stats.accepted - stats.penny;
    const avgOffer = (stats.offerSum - (stats.penny * 10)) / stdCount; // approx, doesn't account for game bundles
    const avgProfit = stats.profitSum / stdCount;
    const totalRatio = stats.offerSum > 0 ? (stats.profitSum / (stats.offerSum - stats.penny * 10)) : 0;
    console.log(`Avg customer offer:      ${dollars(avgOffer)}`);
    console.log(`Avg profit if Amazon FBA: ${dollars(avgProfit)}`);
    console.log(`Profit / Offer ratio:    ${totalRatio.toFixed(2)}x  (Matt makes $${totalRatio.toFixed(2)} for every $1 paid)`);
    console.log(`Items profitable:        ${C.green(stats.profitableCount)}`);
    console.log(`Items at a loss:         ${C.red(stats.lossCount)}`);
  }

  console.log('\n' + C.bold('── Per-category breakdown ──'));
  for (const [cat, s] of Object.entries(stats.byCategory)) {
    if (s.count === 0) continue;
    const acceptRate = (s.accepted / s.count * 100).toFixed(0);
    const avgOffer = s.accepted > 0 ? s.offerSum / s.accepted : 0;
    const avgProfit = s.accepted > 0 ? s.profitSum / s.accepted : 0;
    console.log(
      `  ${cat.padEnd(7)}  ${String(s.accepted).padStart(2)}/${String(s.count).padEnd(2)} accepted (${acceptRate}%)` +
      `  avg offer ${dollars(avgOffer)}  avg profit ${dollars(avgProfit)}`
    );
  }

  console.log('\n' + C.gray('Bundle items not included in profit math — they go to eBay genre lots, not FBA.\n'));
  process.exit(0);
}

analyze().catch(err => { console.error(err); process.exit(1); });

// Test 100 book ISBNs through the V2 offer engine
// Run: node test-100-isbns.js

const ISBNs = [
  '9780439708180', '9780439064873', '9780439136365', '9780439139601',
  '9780439358071', '9780439785969', '9780545139700', '9781737475781',
  '9780134685991', '9780201633610', '9780596007126', '9780131103627',
  '9780132350884', '9780321125217', '9780596517748', '9780062316097',
  '9780062457714', '9781501110368', '9780399590528', '9780735219090',
  '9780525559474', '9781982137274', '9780593139134', '9780593230572',
  '9780735211292', '9781476746586', '9780399226908', '9780062457738',
  '9780316769488', '9780061120084', '9780451524935', '9780743273565',
  '9780060935467', '9780142437179', '9780140449136', '9780143105428',
  '9780307474278', '9780385333481', '9780060850524', '9780140283334',
  '9780547928227', '9780544003415', '9780618640157', '9780618260249',
  '9780553296983', '9780553573404', '9780553381689', '9780553582024',
  '9780553582017', '9780316015844', '9780316160193', '9780316160209',
  '9780316067928', '9780061122415', '9780452284234', '9780385732550',
  '9780316769174', '9780062060624', '9780062024039', '9780062024053',
  '9780439023481', '9780439023498', '9780439023511', '9780316055437',
  '9780385741873', '9780062387240', '9781501161933', '9780399592522',
  '9780593418369', '9780593489482', '9780060555665', '9780307887436',
  '9780062273208', '9780062316110', '9781982141219', '9780593135204',
  '9780593237465', '9780525536512', '9781501171345', '9780593321201',
  '9780399180507', '9780525534716', '9780593132067', '9780062060556',
  '9780310283430', '9780785289043', '9780718037017', '9780310329312',
  '9780071592536', '9780471770886', '9780134093413', '9780134580999',
  '9780321775658', '9780134763293', '9780073527277', '9780134235264',
  '9780134444321', '9780134802749', '9780321856715', '9780495011668',
  '9780134683416',
];

const results = { accepted: 0, low: 0, penny: 0, rejected: 0, errors: 0 };
const details = [];

async function testISBN(isbn, i) {
  try {
    const res = await fetch(`http://localhost:3001/api/quote?code=${isbn}&hasCase=true`);
    const d = await res.json();
    if (!res.ok) {
      results.errors++;
      details.push({ i: i+1, isbn, status: 'error', offer: '-', tier: '-', title: d.error || 'not found' });
      return;
    }
    results[d.status] = (results[d.status] || 0) + 1;
    details.push({
      i: i+1, isbn,
      status: d.status,
      offer: d.offerDisplay || '-',
      tier: d.tier || '-',
      title: (d.title || '').slice(0, 55),
    });
  } catch (err) {
    results.errors++;
    details.push({ i: i+1, isbn, status: 'error', offer: '-', tier: '-', title: err.message.slice(0, 40) });
  }
}

(async () => {
  console.log(`Testing ${ISBNs.length} ISBNs...`);
  const start = Date.now();

  for (let i = 0; i < ISBNs.length; i++) {
    await testISBN(ISBNs[i], i);
    if ((i+1) % 10 === 0) process.stdout.write(`${i+1}... `);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n\nDone in ${elapsed}s\n`);

  const total = ISBNs.length;
  const acceptTotal = results.accepted + results.low + results.penny;
  const featuredTotal = results.accepted + results.low;

  console.log('='.repeat(60));
  console.log('ACCEPTANCE RATE REPORT — V2 Engine');
  console.log('='.repeat(60));
  console.log(`Total tested:       ${total}`);
  console.log(`GREEN  (accepted):  ${results.accepted}  (${Math.round(results.accepted/total*100)}%)`);
  console.log(`YELLOW (low offer): ${results.low}  (${Math.round(results.low/total*100)}%)`);
  console.log(`AMBER  (penny):     ${results.penny}  (${Math.round(results.penny/total*100)}%)`);
  console.log(`RED    (rejected):  ${results.rejected}  (${Math.round(results.rejected/total*100)}%)`);
  console.log(`ERRORS:             ${results.errors}`);
  console.log('-'.repeat(60));
  console.log(`TOTAL ACCEPTANCE:   ${acceptTotal}/${total} = ${Math.round(acceptTotal/total*100)}%`);
  console.log(`  Featured (G+Y):   ${featuredTotal}`);
  console.log(`  Bulk adds (P):    ${results.penny}`);
  console.log('='.repeat(60));

  // Compute average offer
  const accepted = details.filter(d => ['accepted','low','penny'].includes(d.status));
  let totalCents = 0;
  for (const d of accepted) {
    const c = parseFloat(d.offer.replace('$','')) * 100;
    if (!isNaN(c)) totalCents += c;
  }
  const avgOffer = accepted.length > 0 ? (totalCents / accepted.length / 100).toFixed(2) : '0.00';
  const totalOffer = (totalCents / 100).toFixed(2);
  console.log(`Avg accepted offer: $${avgOffer}`);
  console.log(`Total cart value:   $${totalOffer} from ${accepted.length} items`);
  console.log('');

  // Print all items
  console.log('ITEM DETAILS:');
  console.log('-'.repeat(90));
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`${pad('#',4)} ${pad('Status',8)} ${pad('Offer',8)} ${pad('Tier',5)} ${pad('Title',55)}`);
  console.log('-'.repeat(90));
  for (const d of details) {
    const icon = {accepted:'GREEN',low:'YELLOW',penny:'PENNY',rejected:'RED',error:'ERR'}[d.status] || '???';
    console.log(`${pad(d.i,4)} ${pad(icon,8)} ${pad(d.offer,8)} ${pad(d.tier,5)} ${d.title}`);
  }
})();

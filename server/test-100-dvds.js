// Test 100 DVD UPCs through the V2 offer engine
// Run: node test-100-dvds.js

const UPCs = [
  // Popular/classic DVDs
  '0786936215595', // Finding Nemo
  '0786936233513', // The Incredibles
  '0786936244250', // Cars
  '0786936292916', // Wall-E
  '0786936756401', // Frozen
  '0786936842128', // Moana
  '0786936862034', // Coco
  '0717951010889', // Lion King
  '0786936155815', // Toy Story
  '0786936170535', // Monsters Inc
  '0024543213796', // Fight Club
  '0024543040651', // Office Space
  '0012569593268', // Shawshank Redemption
  '0085391163824', // The Matrix
  '0085391174028', // Goodfellas
  '0012569791374', // Pulp Fiction
  '0883929037810', // Dark Knight
  '0883929322107', // Inception
  '0883929416226', // Interstellar
  '0883316218969', // Forrest Gump
  '0097360719246', // Gladiator
  '0032429262585', // Schindlers List
  '0025192018626', // Jurassic Park
  '0025192112836', // Back to the Future
  '0025192232442', // E.T.
  '0043396514386', // Spider-Man
  '0043396242418', // Men in Black
  '0043396039643', // Jerry Maguire
  '0043396061330', // Ghostbusters
  '0043396200531', // The Patriot
  '0794043533327', // Spirited Away
  '0794043581021', // Princess Mononoke
  '0794043722127', // My Neighbor Totoro
  '0794043836527', // Howls Moving Castle
  '0794043156625', // Nausicaa
  '0883929002764', // 300
  '0883929088577', // Hangover
  '0883929152506', // Sherlock Holmes
  '0883929237395', // Harry Potter Complete
  '0883929343164', // Mad Max Fury Road
  '0024543547457', // Die Hard
  '0024543214311', // Alien
  '0024543561040', // Avatar
  '0024543876403', // Deadpool
  '0024543493143', // Napoleon Dynamite
  '0031398134183', // John Wick
  '0031398257301', // John Wick 2
  '0031398281955', // John Wick 3
  '0024543908371', // Logan
  '0024543566236', // X-Men Days Future Past
  // TV Series box sets
  '0883929020706', // Friends Season 1
  '0883929282531', // Game of Thrones S1
  '0883929375561', // Breaking Bad Complete
  '0024543905288', // The Office S1
  '0097360816747', // Seinfeld S1
  '0883929525973', // Sopranos Complete
  '0883929099207', // The Wire Complete
  '0024543602637', // Lost S1
  '0024543547051', // 24 S1
  '0024543599036', // Prison Break S1
  // Horror
  '0031398250715', // Halloween (2018)
  '0031398289937', // Us
  '0031398299738', // Get Out
  '0883929604449', // It (2017)
  '0024543547853', // Alien vs Predator
  '0012569844384', // The Shining
  '0883929346486', // The Conjuring
  '0883929416417', // Annabelle
  // Kids/Reject tier
  '0097361438740', // Paw Patrol
  '0032429346230', // Dora the Explorer
  '0097368949744', // SpongeBob Movie
  '0191329047385', // Boss Baby DreamWorks
  '0024543776185', // Ice Age
  '0097361461748', // Blaze and Monster Machines
  // Workout/fitness
  '0013131643398', // P90X
  '0018713529206', // Insanity
  '0013131644395', // T25
  // Music/concert
  '0602498621448', // U2 Vertigo Tour
  '0886979414297', // Michael Jackson This Is It
  // Criterion Collection
  '0715515238618', // Seven Samurai Criterion
  '0715515021012', // 8 1/2 Criterion
  '0715515183314', // Stalker Criterion
  // Steelbooks/4K/Collector
  '0883929706105', // Batman Begins 4K
  '0883929706624', // Dark Knight 4K
  // Budget/misc
  '0012569700079', // Titanic
  '0097360171945', // Braveheart
  '0097360401448', // Top Gun
  '0097361394046', // Grease
  '0025195053495', // Jaws
  '0043396473690', // Karate Kid
  '0012569820173', // Indiana Jones
  '0025192006821', // Scarface
  '0043396103993', // Stand By Me
  '0012569724624', // Breakfast Club
  '0097360721744', // Ferris Bueller
  '0012569791978', // Reservoir Dogs
  '0024543206934', // Cast Away
  '0012569511828', // Saving Private Ryan
  '0883929454297', // American Sniper
];

const results = { accepted: 0, low: 0, penny: 0, rejected: 0, errors: 0 };
const details = [];

async function testUPC(upc, i) {
  try {
    const res = await fetch(`http://localhost:3001/api/quote?code=${upc}&hasCase=true`);
    const d = await res.json();
    if (!res.ok) {
      results.errors++;
      details.push({ i: i+1, upc, status: 'error', offer: '-', tier: '-', title: d.error || 'not found' });
      return;
    }
    results[d.status] = (results[d.status] || 0) + 1;
    details.push({
      i: i+1, upc,
      status: d.status,
      offer: d.offerDisplay || '-',
      tier: d.tier || '-',
      title: (d.title || '').slice(0, 55),
    });
  } catch (err) {
    results.errors++;
    details.push({ i: i+1, upc, status: 'error', offer: '-', tier: '-', title: err.message.slice(0, 40) });
  }
}

(async () => {
  console.log(`Testing ${UPCs.length} DVD UPCs...`);
  const start = Date.now();

  for (let i = 0; i < UPCs.length; i++) {
    await testUPC(UPCs[i], i);
    if ((i+1) % 10 === 0) process.stdout.write(`${i+1}... `);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n\nDone in ${elapsed}s\n`);

  const total = UPCs.length;
  const acceptTotal = results.accepted + results.low + results.penny;
  const featuredTotal = results.accepted + results.low;

  console.log('='.repeat(60));
  console.log('ACCEPTANCE RATE REPORT — V2 Engine (DVDs)');
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

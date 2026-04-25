// ============================================================
// offerEngine.js — Spec-aligned 11-step algorithm
//
// All prices in CENTS (integers). Pure JS (no TypeScript).
//
// Implements CLEANSLATE_DB_AND_ENGINE.md §2.2 exactly:
//   Step 1  — UPC -> ASIN resolution
//   Step 2  — Cache freshness check (data_age_days <= 30)
//   Step 3  — Hard rejection filters (hazmat/adult/oversize/blacklist/do_not_buy/inventory_cap)
//   Step 4  — Velocity check (sales_rank_drops_90 >= 4) + tier assignment
//   Step 5  — Price determination: MIN(current_buybox, avg_90_day_buybox) + volatility gate
//   Step 6  — Competition check (Amazon-on-listing, fba_offer_count)
//   Step 7  — Fee calculation (reads offer_engine_config)
//   Step 8  — Net resale value
//   Step 9  — Inventory throttling (MVP: always 1.00)
//   Step 10 — ROI floor + final offer
//   Step 11 — Sanity checks
//
// Every REJECT path populates the CalculationTrace with everything
// collected up to that point and sets rejection_step (1..11).
// ============================================================

const tt = require('./tierThresholds');

// ------------------------------------------------------------
// Hardcoded tables (spec §2.5, §2.6 — architectural rules, not
// tunable parameters, so not in offer_engine_config).
// ------------------------------------------------------------

// Category blacklist (case-insensitive substring match against category_tree joined)
const CATEGORY_BLACKLIST = [
  'textbook',
  'workbook',
  'solutions manual',
  'vhs',
  'cassette',
  'vinyl',
  'lp record',
  'coloring',
  'journal',
];

// Minimum viable working price by category
const CATEGORY_MIN_PRICE_CENTS = {
  book:   200,
  dvd:    250,
  bluray: 250,
  cd:     600,
  game:   500,
};

const DEFAULT_WEIGHT_GRAMS = 400;

// Oversize thresholds (mm / g) — spec §2.2 Step 3
const MAX_LENGTH_MM = 457; // 18 in
const MAX_WIDTH_MM  = 356; // 14 in
const MAX_HEIGHT_MM = 203; // 8 in
const MAX_WEIGHT_G  = 9072; // 20 lbs

// ------------------------------------------------------------
// Sub-category classifier (V2 spec + eBay bundle economics)
//
// Three outcomes per item:
//   1. KEEPER  → goes to Amazon FBA individually ($0.10 penny, min net $0.50)
//   2. BUNDLE  → goes into a genre-specific eBay bulk lot ($0.05 penny, min net $0.25)
//              Genre determines the lot label ("25 Horror DVDs", "Metal CDs", etc.)
//   3. REJECT  → truly unsellable, even in a bundle
//
// eBay bundle economics:
//   A lot of 25 genre-matched DVDs sells for $15-35 on eBay depending on genre.
//   After eBay fees (~13%) + flat-rate shipping (~$10), net is $3-20 per lot.
//   At $0.05/item acquisition cost, 25 items = $1.25 cost → profitable on any genre
//   that nets $3+ per lot. The genre tag just determines what lot it goes into.
// ------------------------------------------------------------

const REJECT_PATTERNS = {
  book: [/romance/i, /reader'?s?\s*digest/i, /harlequin/i, /danielle\s*steel/i,
         /nora\s*roberts/i, /coloring\s*book/i, /activity\s*book/i],
  dvd:  [/dreamworks/i, /nickelodeon/i, /paw\s*patrol/i, /nick\s*jr/i, /barney/i, /teletubbies/i,
         /sports\s*highlight/i, /nfl\s*films/i, /espn/i],
  bluray: [/paw\s*patrol/i, /nick\s*jr/i, /barney/i],
  cd:   [/now\s*that'?s?\s*what\s*i\s*call/i, /kidz\s*bop/i, /various\s*artists/i,
         /top\s*40/i, /NOW\s*\d+/i, /karaoke/i],
  game: [/\b(madden|nba\s*2k|fifa|nhl|mlb|wwe|pes|pro\s*evolution)\b/i,
         /\bdemo\b/i, /\bpromo\b/i],
};

const KEEPER_PATTERNS = {
  book: [/textbook/i, /\bedition\b/i, /engineering/i, /medical/i, /theology/i,
         /\bd\s*&\s*d\b/i, /dungeons/i, /programming/i, /computer science/i,
         /nursing/i, /anatomy/i, /physics/i, /chemistry/i, /calculus/i,
         /law\b/i, /legal/i],
  dvd:  [/criterion/i, /arrow\s*video/i, /scream\s*factory/i, /4k\s*uhd/i,
         /steelbook/i, /collector/i, /tv\s*(series|season|box\s*set|complete)/i],
  bluray: [/criterion/i, /arrow\s*video/i, /scream\s*factory/i, /4k\s*uhd/i,
           /steelbook/i, /collector/i, /tv\s*(series|season|box\s*set|complete)/i],
  cd:   [/box\s*set/i, /import/i, /limited/i, /promo/i, /vinyl/i],
  game: [], // games default to keeper
};

// Genre detection for eBay bundle lots.
// Returns a genre tag that becomes the lot label ("Horror DVDs", "Metal CDs", etc.)
// Order matters: first match wins.
const GENRE_RULES = {
  dvd: [
    { genre: 'horror',     patterns: [/horror/i, /slasher/i, /zombie/i, /vampire/i, /haunting/i, /exorcis/i, /nightmare/i, /scream\b/i, /saw\b/i, /conjuring/i, /evil\s*dead/i] },
    { genre: 'action',     patterns: [/action/i, /thriller/i, /mission\s*impossible/i, /fast\s*(and|&)\s*furious/i, /die\s*hard/i, /john\s*wick/i, /james\s*bond/i, /007/i, /marvel/i, /avengers/i, /batman/i, /spider.?man/i] },
    { genre: 'comedy',     patterns: [/comedy/i, /funny/i, /laugh/i, /hangover/i, /superbad/i, /adam\s*sandler/i, /will\s*ferrell/i, /jim\s*carrey/i] },
    { genre: 'sci-fi',     patterns: [/sci.?fi/i, /science\s*fiction/i, /star\s*wars/i, /star\s*trek/i, /alien/i, /terminator/i, /matrix/i, /blade\s*runner/i] },
    { genre: 'anime',      patterns: [/anime/i, /ghibli/i, /miyazaki/i, /manga/i, /dragon\s*ball/i, /naruto/i, /one\s*piece/i, /gundam/i] },
    { genre: 'disney',     patterns: [/disney/i, /pixar/i, /frozen/i, /moana/i, /lion\s*king/i, /aladdin/i, /toy\s*story/i, /finding\s*(nemo|dory)/i] },
    { genre: 'drama',      patterns: [/drama/i, /oscar/i, /academy\s*award/i] },
    { genre: 'workout',    patterns: [/workout/i, /fitness/i, /exercise/i, /yoga/i, /p90x/i, /insanity/i, /pilates/i, /jillian/i] },
    { genre: 'christian',  patterns: [/christian/i, /faith/i, /gospel/i, /church/i, /bible/i, /veggie\s*tales/i] },
    { genre: 'kids',       patterns: [/kids/i, /children/i, /family/i, /animated/i, /cartoon/i, /sesame/i] },
  ],
  bluray: 'dvd', // same genre rules as DVD
  cd: [
    { genre: 'rock',       patterns: [/rock/i, /metal/i, /punk/i, /grunge/i, /alternative/i, /hard\s*rock/i, /classic\s*rock/i, /iron\s*maiden/i, /metallica/i, /nirvana/i, /ac\/?dc/i, /led\s*zeppelin/i] },
    { genre: 'hip-hop',    patterns: [/hip.?hop/i, /rap/i, /r\s*&\s*b/i, /rnb/i, /kanye/i, /drake/i, /eminem/i, /jay.?z/i, /tupac/i, /biggie/i, /kendrick/i] },
    { genre: 'country',    patterns: [/country/i, /nashville/i, /bluegrass/i, /johnny\s*cash/i, /dolly/i, /garth/i, /willie\s*nelson/i] },
    { genre: 'jazz',       patterns: [/jazz/i, /blues/i, /swing/i, /miles\s*davis/i, /coltrane/i, /monk/i, /ella/i] },
    { genre: 'classical',  patterns: [/classical/i, /symphony/i, /orchestra/i, /beethoven/i, /mozart/i, /bach/i, /chopin/i, /opera/i] },
    { genre: 'christian',  patterns: [/christian/i, /gospel/i, /worship/i, /hymn/i, /hillsong/i] },
    { genre: 'soundtrack', patterns: [/soundtrack/i, /original\s*(motion|cast)/i, /score/i, /ost\b/i] },
    { genre: 'pop',        patterns: [/pop/i, /dance/i, /electronic/i, /edm/i, /synth/i] },
  ],
  book: [
    { genre: 'sci-fi',     patterns: [/sci.?fi/i, /science\s*fiction/i, /fantasy/i, /tolkien/i, /asimov/i, /dune\b/i, /game\s*of\s*thrones/i] },
    { genre: 'mystery',    patterns: [/mystery/i, /thriller/i, /detective/i, /suspense/i, /crime/i, /murder/i, /whodunit/i] },
    { genre: 'history',    patterns: [/history/i, /historical/i, /world\s*war/i, /civil\s*war/i, /biography/i, /memoir/i] },
    { genre: 'self-help',  patterns: [/self.?help/i, /motivation/i, /habit/i, /mindset/i, /success/i, /productivity/i, /leadership/i] },
    { genre: 'business',   patterns: [/business/i, /entrepreneur/i, /marketing/i, /finance/i, /invest/i, /startup/i, /management/i] },
    { genre: 'religion',   patterns: [/christian/i, /bible/i, /faith/i, /church/i, /spiritual/i, /devotion/i, /prayer/i] },
    { genre: 'cooking',    patterns: [/cook/i, /recipe/i, /kitchen/i, /baking/i, /food/i, /chef/i] },
    { genre: 'fiction',    patterns: [/novel/i, /fiction/i, /stories/i] },
  ],
  game: [
    { genre: 'rpg',        patterns: [/rpg/i, /role.?play/i, /final\s*fantasy/i, /zelda/i, /elder\s*scrolls/i, /witcher/i, /dragon\s*age/i, /persona/i, /dark\s*souls/i] },
    { genre: 'shooter',    patterns: [/shooter/i, /call\s*of\s*duty/i, /halo\b/i, /battlefield/i, /gears\s*of\s*war/i, /doom\b/i, /bioshock/i] },
    { genre: 'adventure',  patterns: [/adventure/i, /uncharted/i, /tomb\s*raider/i, /assassin/i, /god\s*of\s*war/i, /red\s*dead/i, /gta\b/i, /grand\s*theft/i] },
    { genre: 'nintendo',   patterns: [/mario/i, /pokemon/i, /kirby/i, /smash\s*bros/i, /animal\s*crossing/i, /splatoon/i, /metroid/i] },
    { genre: 'racing',     patterns: [/racing/i, /forza/i, /gran\s*turismo/i, /need\s*for\s*speed/i, /mario\s*kart/i] },
  ],
};

function detectGenre(category, title) {
  let rules = GENRE_RULES[category];
  if (typeof rules === 'string') rules = GENRE_RULES[rules]; // bluray -> dvd
  if (!rules) return 'mixed';
  const text = (title || '').toLowerCase();
  for (const { genre, patterns } of rules) {
    for (const p of patterns) {
      if (p.test(text)) return genre;
    }
  }
  return 'mixed'; // no genre matched — goes into a "mixed lot"
}

function classifySubCategory(category, title) {
  const text = (title || '').toLowerCase();

  // 1. Check reject patterns
  const rejectPatterns = REJECT_PATTERNS[category] || [];
  for (const pattern of rejectPatterns) {
    if (pattern.test(text)) {
      return {
        subCategory: `reject_${category}`,
        reject: true,
        rejectReason: `Sub-category not accepted (${category})`,
        pennyOffer: 0,
        minNetProfit: 0,
        genre: null,
        disposition: null,
      };
    }
  }

  // 2. Check keeper patterns (Amazon FBA individually)
  const keeperPatterns = KEEPER_PATTERNS[category] || [];
  for (const pattern of keeperPatterns) {
    if (pattern.test(text)) {
      return {
        subCategory: `keeper_${category}`,
        pennyOffer: 10,   // $0.10
        minNetProfit: 50,  // $0.50
        reject: false,
        genre: null,
        disposition: 'amazon_fba',
      };
    }
  }

  // 3. Games default to keeper (hold value well)
  if (category === 'game') {
    return {
      subCategory: `keeper_${category}`,
      pennyOffer: 10,
      minNetProfit: 50,
      reject: false,
      genre: detectGenre(category, title),
      disposition: 'amazon_fba',
    };
  }

  // 4. Everything else → eBay bundle lot by genre
  const genre = detectGenre(category, title);
  return {
    subCategory: `bundle_${category}`,
    pennyOffer: 5,     // $0.05
    minNetProfit: 25,   // $0.25
    reject: false,
    genre,
    disposition: 'ebay_bundle',
    bundleLabel: formatBundleLabel(category, genre),
  };
}

function formatBundleLabel(category, genre) {
  const catNames = { book: 'Books', dvd: 'DVDs', bluray: 'Blu-rays', cd: 'CDs', game: 'Games' };
  const genreNames = {
    horror: 'Horror', action: 'Action', comedy: 'Comedy', 'sci-fi': 'Sci-Fi',
    anime: 'Anime', disney: 'Disney', drama: 'Drama', workout: 'Workout',
    christian: 'Christian', kids: 'Kids', rock: 'Rock/Metal', 'hip-hop': 'Hip-Hop/R&B',
    country: 'Country', jazz: 'Jazz/Blues', classical: 'Classical', soundtrack: 'Soundtracks',
    pop: 'Pop/Dance', mystery: 'Mystery/Thriller', history: 'History', 'self-help': 'Self-Help',
    business: 'Business', religion: 'Religious', cooking: 'Cooking', fiction: 'Fiction',
    rpg: 'RPG', shooter: 'Shooter', adventure: 'Adventure', nintendo: 'Nintendo', racing: 'Racing',
    mixed: 'Mixed',
  };
  return `${genreNames[genre] || 'Mixed'} ${catNames[category] || 'Items'}`;
}

// ------------------------------------------------------------
// Deprecated-param warning with dedup by caller stack frame.
// ------------------------------------------------------------
const _warnedCallers = new Set();
function warnDeprecated(paramName, value) {
  const stack = new Error().stack || '';
  // Line [2] in stack is the caller of the function that called warnDeprecated
  const key = (stack.split('\n')[3] || 'unknown').trim();
  if (_warnedCallers.has(key + ':' + paramName)) return;
  _warnedCallers.add(key + ':' + paramName);
  console.warn(
    `[offerEngine] Deprecated param "${paramName}"=${JSON.stringify(value)} ` +
    `passed from ${key} — ignored. See spec §4.1.`
  );
}

// ------------------------------------------------------------
// Keepa field extraction (spec §2.3)
// Normalizes raw Keepa product response -> KeepaExtractedFields
// Keepa convention: -1 means "no data".
// ------------------------------------------------------------
function extractKeepaFields(product) {
  const stats = product.stats || {};
  const cur   = stats.current || [];
  const avg90 = stats.avg90   || [];
  const min90 = stats.min90   || [];
  const max90 = stats.max90   || [];

  const nz = (v) => (v != null && v !== -1 ? v : null);

  // Category tree normalization: Keepa returns array of {catId,name}
  const categoryTree = Array.isArray(product.categoryTree)
    ? product.categoryTree.map(c => (c && c.name) || '').filter(Boolean)
    : [];

  // data_age_days: Keepa `lastUpdate` is minutes since Keepa epoch (2011-01-01)
  const KEEPA_EPOCH_MS = 1293840000000;
  let dataAgeDays = 0;
  if (product.lastUpdate && typeof product.lastUpdate === 'number') {
    const lastMs = KEEPA_EPOCH_MS + product.lastUpdate * 60000;
    dataAgeDays = Math.max(0, Math.floor((Date.now() - lastMs) / 86400000));
  }

  return {
    asin: product.asin || null,
    title: product.title || '',
    category_tree: categoryTree,
    category_root: null, // populated by detectCategory()
    // Fallback signals when category_tree is sparse/missing — Keepa exposes
    // explicit format hints in `binding` (e.g., "DVD", "Audio CD", "Hardcover")
    // and `productGroup` ("Book", "DVD", "Music", "Video Games", "Toy").
    binding: product.binding || '',
    product_group: product.productGroup || '',

    // Prices (cents) — used-buybox anchor for buyback pricing.
    // NOTE: Keepa index 18 = New Buy Box Shipping (wrong for used resale).
    //       Keepa index 32 = Used Buy Box (what we actually want).
    // The spec §2.3 mapping was incorrect for a used-media buyback business
    // and said index 18; we override to 32 here and rename the fields to
    // current_used_buybox_cents / avg_90_day_used_buybox_cents / ... for clarity.
    current_used_buybox_cents:     nz(cur[32]),
    current_amazon_cents:          nz(cur[0]),
    current_new_3p_cents:          nz(cur[1]),
    avg_90_day_used_buybox_cents:  nz(avg90[32]),
    avg_180_day_used_buybox_cents: nz((stats.avg180 || [])[32]),
    min_90_day_used_cents:         nz(min90[32]),
    max_90_day_used_cents:         nz(max90[32]),

    // Rank
    current_bsr:      nz(cur[3]),
    avg_90_day_bsr:   nz(avg90[3]),

    // Velocity (spec §4.1 rule 3 — the primary signal)
    sales_rank_drops_30:  stats.salesRankDrops30  ?? 0,
    sales_rank_drops_90:  stats.salesRankDrops90  ?? 0,
    sales_rank_drops_180: stats.salesRankDrops180 ?? 0,

    // Competition
    new_offer_count: nz(cur[11]) ?? 0,
    fba_offer_count: product.newOffersFBA ?? 0,
    amazon_is_seller: (cur[0] != null && cur[0] !== -1),

    // Package dims
    package_height_mm: nz(product.packageHeight),
    package_length_mm: nz(product.packageLength),
    package_width_mm:  nz(product.packageWidth),
    package_weight_g:  nz(product.packageWeight) ?? nz(product.itemWeight),

    // Flags
    is_hazmat:   product.hazardousMaterialType != null && product.hazardousMaterialType !== 0,
    is_adult:    !!product.isAdultProduct,
    is_redirect: !!product.isRedirectASIN,

    data_age_days: dataAgeDays,
  };
}

// ------------------------------------------------------------
// Category detection (bluray-before-dvd ordering per Matt's direction)
//
// Rules:
//   1. Digital-only formats (Kindle, Audible, MP3, Prime/Instant/Amazon Video)
//      always return null — customer must ship physical media.
//   2. Physical-media detection in priority order (bluray before dvd).
//   3. Game detection requires the exact phrase "video games" — we never
//      match on bare "games" because that would catch "Toys & Games".
//   4. Book detection requires "books" AND no digital markers. Substrings
//      like "cookbooks" correctly match via the "books" substring.
// ------------------------------------------------------------
function detectCategory(categoryTreeOrFields) {
  // Backwards-compatible: accept either the legacy categoryTree array
  // or the full extractedFields object (preferred — gives us binding/productGroup
  // fallback signals when the category_tree is sparse).
  let categoryTree = [];
  let binding = '';
  let productGroup = '';
  if (Array.isArray(categoryTreeOrFields)) {
    categoryTree = categoryTreeOrFields;
  } else if (categoryTreeOrFields && typeof categoryTreeOrFields === 'object') {
    categoryTree = categoryTreeOrFields.category_tree || [];
    binding = (categoryTreeOrFields.binding || '').toLowerCase();
    productGroup = (categoryTreeOrFields.product_group || '').toLowerCase();
  }

  const joined = (Array.isArray(categoryTree) ? categoryTree : []).join(' ').toLowerCase();

  // Gate 1: reject any digital-only format outright.
  // Checked BEFORE physical matches so Kindle/Audible/MP3/Prime Video
  // always return null even if the tree also mentions a physical category.
  if (joined.includes('kindle') || binding.includes('kindle')) return null;
  if (joined.includes('audible') || binding.includes('audible')) return null;
  if (joined.includes('mp3') || binding.includes('mp3')) return null;
  if (joined.includes('digital music')) return null;
  if (joined.includes('prime video')) return null;
  if (joined.includes('instant video')) return null;
  if (joined.includes('amazon video')) return null;

  // Gate 1b: reject vinyl records — Matt's business doesn't buy them.
  // Vinyl LPs share Amazon's "CDs & Vinyl" category with CDs but have a
  // different binding ("Vinyl" / "Vinyl LP" / "Audio LP"). Reject early
  // so the CDs & Vinyl category match below doesn't accidentally accept them.
  if (binding === 'vinyl' || binding.includes('vinyl lp') || binding.includes('audio lp')) return null;
  if (productGroup === 'vinyl' || productGroup.includes('vinyl lp')) return null;

  // Gate 2: physical-media detection. Order matters: bluray before dvd
  // because Amazon nests "Movies & TV > Blu-ray > DVD" in category trees.
  if (joined.includes('blu-ray') || joined.includes('bluray')) return 'bluray';
  if (joined.includes('dvd')) return 'dvd';
  // "Movies & TV" without "Prime Video"/"Instant Video" = physical DVD/Blu-ray.
  // Many DVDs on Amazon are just categorized as "Movies & TV > Movies" or
  // "Movies & TV > TV" without the word "DVD" in the tree at all.
  if (joined.includes('movies & tv') || joined.includes('movies &amp; tv')) return 'dvd';
  // Game requires the FULL phrase "video games" — bare "games" would
  // false-match "Toys & Games", "Board Games", etc.
  if (joined.includes('video games') || joined.includes('videogames')) return 'game';
  if (joined.includes('cds & vinyl') || joined.includes('cds and vinyl')) return 'cd';
  if (joined.includes('music') && joined.includes('cds')) return 'cd';
  // Bare "music" without "cds" — could be physical CDs categorized loosely
  if (joined.includes('music')) return 'cd';
  // Book is last so digital-book markers have a chance to disqualify first.
  if (joined.includes('books')) return 'book';

  // Gate 3: BINDING / PRODUCT_GROUP fallback. When the category tree is sparse
  // (Keepa data quality varies for older/niche items), Amazon's `binding` and
  // `productGroup` fields almost always identify the format directly.
  // Order: bluray > dvd > game > cd > book to match Gate 2 priority.
  if (binding.includes('blu-ray') || binding.includes('bluray')) return 'bluray';
  if (binding.includes('dvd') || binding.includes('vhs')) return 'dvd';
  if (binding === 'video game' || binding.includes('video game') || productGroup.includes('video game')) return 'game';
  if (binding.includes('audio cd') || binding === 'cd') return 'cd';
  if (productGroup === 'music') return 'cd';
  if (
    binding.includes('hardcover') ||
    binding.includes('paperback') ||
    binding.includes('mass market') ||
    binding.includes('board book') ||
    binding === 'book' ||
    binding.includes('library binding') ||
    binding.includes('spiral-bound') ||
    productGroup === 'book'
  ) return 'book';
  if (productGroup === 'dvd') return 'dvd';

  return null;
}

// ------------------------------------------------------------
// FBA fee lookup (spec §2.7)
// Returns cents. Assumes caller already filtered oversize at Step 3.
// ------------------------------------------------------------
// V2 FBA fee table — weight-based lookup per V2 spec
function lookupFBAFee(weight_g) {
  const weight_lbs = weight_g / 453.592;
  if (weight_lbs <= 0.5) return 306;
  if (weight_lbs <= 1.0) return 340;
  if (weight_lbs <= 1.5) return 375;
  if (weight_lbs <= 2.0) return 420;
  if (weight_lbs <= 3.0) return 475;
  return 475 + Math.ceil((weight_lbs - 3) * 50);
}

// ------------------------------------------------------------
// Category blacklist check
// ------------------------------------------------------------
function hitsBlacklist(categoryTree) {
  if (!Array.isArray(categoryTree) || categoryTree.length === 0) return null;
  const joined = categoryTree.join(' ').toLowerCase();
  for (const term of CATEGORY_BLACKLIST) {
    if (joined.includes(term)) return term;
  }
  return null;
}

// ------------------------------------------------------------
// Gated-brand/ASIN check — reads from DB-loaded cache in
// tierThresholds.js (gated_items table). Falls back to hardcoded
// patterns if the table hasn't been loaded yet (e.g. in tests
// that don't inject gated items).
//
// Checks: ASIN exact match, then brand substring match against
// product.brand, product.manufacturer, and product.title.
// ------------------------------------------------------------

// Hardcoded fallbacks (only used if gated_items table is empty/missing).
// Once the migration is applied and items are in the DB, these are redundant.
const GATED_ASINS_FALLBACK = new Set();
const GATED_BRAND_FALLBACK = ['disney', 'studio ghibli', 'criterion collection'];

function isGated(product) {
  const dbAsins = tt.getGatedAsins();
  const dbBrands = tt.getGatedBrands();

  // Use DB-loaded lists if available, otherwise fallback
  const asinSet = dbAsins.size > 0 ? dbAsins : GATED_ASINS_FALLBACK;
  const brandList = dbBrands.length > 0 ? dbBrands : GATED_BRAND_FALLBACK;

  // ASIN exact match
  if (product.asin && asinSet.has(product.asin.toUpperCase())) {
    return { gated: true, reason: 'asin_blocked', brand: product.asin };
  }

  // Brand substring match against brand, manufacturer, title
  const searchFields = [
    (product.brand || '').toLowerCase(),
    (product.manufacturer || '').toLowerCase(),
    (product.title || '').toLowerCase(),
  ].join(' ');

  for (const pattern of brandList) {
    if (searchFields.includes(pattern)) {
      return { gated: true, reason: 'brand_gated', brand: pattern };
    }
  }

  return { gated: false };
}

// Legacy exports for backward compat (tests may reference these)
const GATED_ASINS = GATED_ASINS_FALLBACK;
const GATED_BRAND_PATTERNS = GATED_BRAND_FALLBACK.map(b => new RegExp(b, 'i'));

// ------------------------------------------------------------
// CalculationTrace builder (spec §2.1)
// ------------------------------------------------------------
function newTrace() {
  return {
    asin: null,
    category: null,
    keepa_fields: null,
    hard_rejections_checked: [],
    working_price_cents: null,
    working_price_source: null,
    volatility_ratio: null,
    velocity_signal: null,
    tier_assigned: null,
    fees_breakdown: null,
    net_resale_cents: null,
    roi_floor_applied: null,
    required_margin_cents: null,
    inventory_penalty_applied: 1.0,
    competition_penalty_applied: 1.0,
    final_offer_cents: null,
    rejection_step: null,
    rejection_reason_detail: null,
  };
}

function rejectWith(trace, step, reason, detail = null) {
  trace.rejection_step = step;
  trace.rejection_reason_detail = detail || reason;
  return {
    accepted: false,
    rejection_reason: reason,
    calculation_trace: trace,
    keepa_data_timestamp: new Date(),
  };
}

function acceptWith(trace, offerCents, tier, isPennyTier = false) {
  return {
    accepted: true,
    offer_cents: offerCents,
    tier,
    is_penny_tier: isPennyTier,
    calculation_trace: trace,
    keepa_data_timestamp: new Date(),
  };
}

// ------------------------------------------------------------
// The 11-step algorithm
//
// opts:
//   inventoryCount:   number, defaults to 0 (Step 3 cap check & Step 9 throttle)
//   doNotBuyMatch:    boolean, defaults to false (Step 3 cooldown check)
//   gatedResult:      object, result of isGated(rawProduct) if already computed
//
// Returns OfferEngineOutput per spec §2.1.
// ------------------------------------------------------------
function runOfferEngine(rawProduct, extractedFields, opts = {}) {
  const trace = newTrace();

  // ===== STEP 1: UPC -> ASIN resolution =====
  if (!extractedFields || !extractedFields.asin) {
    return rejectWith(trace, 1,
      "Barcode not recognized. Make sure you're scanning a physical book, DVD, Blu-ray, CD, or video game.");
  }
  trace.asin = extractedFields.asin;

  // ===== STEP 2: Data freshness =====
  if (extractedFields.data_age_days > 30) {
    trace.keepa_fields = extractedFields;
    return rejectWith(trace, 2, 'Insufficient recent data',
      `data_age_days=${extractedFields.data_age_days}`);
  }
  trace.keepa_fields = extractedFields;

  // ===== STEP 3: Hard rejection filters =====
  const checks = trace.hard_rejections_checked;

  checks.push('is_hazmat');
  if (extractedFields.is_hazmat) return rejectWith(trace, 3, 'Hazmat restricted');

  checks.push('is_adult');
  if (extractedFields.is_adult) return rejectWith(trace, 3, 'Adult content restricted');

  checks.push('is_redirect');
  if (extractedFields.is_redirect) return rejectWith(trace, 3, 'Listing deprecated');

  checks.push('package_dims');
  if (extractedFields.package_height_mm == null ||
      extractedFields.package_length_mm == null ||
      extractedFields.package_width_mm  == null ||
      extractedFields.package_weight_g  == null) {
    return rejectWith(trace, 3, 'Insufficient product data');
  }

  checks.push('oversize');
  if (extractedFields.package_length_mm > MAX_LENGTH_MM ||
      extractedFields.package_width_mm  > MAX_WIDTH_MM  ||
      extractedFields.package_height_mm > MAX_HEIGHT_MM) {
    return rejectWith(trace, 3, 'Oversize');
  }

  checks.push('overweight');
  if (extractedFields.package_weight_g > MAX_WEIGHT_G) {
    return rejectWith(trace, 3, 'Overweight');
  }

  checks.push('category_blacklist');
  const blacklistHit = hitsBlacklist(extractedFields.category_tree);
  if (blacklistHit) {
    return rejectWith(trace, 3, 'Category not accepted', `matched:${blacklistHit}`);
  }

  // Gated brand check disabled for now — Disney owns too much of the DVD
  // catalog (Fox, Searchlight, FX) and false-positives on items like King
  // of the Hill. Will re-enable with more specific rules later.
  // checks.push('gated_brand');

  checks.push('do_not_buy');
  if (opts.doNotBuyMatch) {
    return rejectWith(trace, 3, 'Item on cooldown list');
  }

  checks.push('inventory_cap');
  const maxCopies = tt.getConfig('max_copies_per_asin');
  const invCount = opts.inventoryCount || 0;
  if (invCount >= maxCopies) {
    return rejectWith(trace, 3, 'We have enough of this item right now');
  }

  // ===== STEP 4: Category gate + velocity + tier =====

  // 4a: Category detection happens FIRST. If the category tree doesn't map
  // to one of our 5 supported physical-media categories, reject immediately
  // with a customer-facing message that explains what we DO buy. This runs
  // before the velocity check so a cereal-box scan gets the right reason
  // instead of confusing "low velocity" / "below tier thresholds" noise.
  // Pass full extractedFields so detectCategory can fall back to Keepa's
  // `binding` / `productGroup` when the category_tree is sparse.
  const category = detectCategory(extractedFields);
  if (!category) {
    return rejectWith(trace, 4,
      'We only buy books, DVDs, Blu-rays, CDs, and video games',
      `category_tree=${JSON.stringify(extractedFields.category_tree)} binding=${extractedFields.binding} group=${extractedFields.product_group}`);
  }
  extractedFields.category_root = category;
  trace.category = category;

  // 4b: Velocity check against the spec §4.1 rule 3 floor.
  const rankDrops90 = extractedFields.sales_rank_drops_90;
  trace.velocity_signal = rankDrops90;

  if (rankDrops90 < 4) {
    // Low velocity on Amazon — but might still work in an eBay genre bundle.
    // Gate: must have a used buybox price >= $3.00 (proves the item has real
    // resale value, not just junk) and can't be a reject sub-category.
    const EBAY_LOW_VELOCITY_MIN_PRICE = 300; // $3.00
    const currentPrice = extractedFields.current_used_buybox_cents ?? extractedFields.current_new_3p_cents;
    if (currentPrice && currentPrice >= EBAY_LOW_VELOCITY_MIN_PRICE) {
      const subCat = classifySubCategory(category, extractedFields.title);
      if (!subCat.reject) {
        trace.final_offer_cents = 5;
        trace.penny_tier_applied = true;
        trace.penny_offer_cents = 5;
        trace.penny_net_profit_cents = null;
        trace.sub_category = subCat.subCategory;
        trace.genre = subCat.genre || null;
        trace.disposition = 'ebay_bundle';
        trace.bundle_label = subCat.bundleLabel || formatBundleLabel(category, subCat.genre || 'mixed');
        trace.ebay_fallback = true;
        trace.ebay_fallback_reason = 'low_velocity';
        return acceptWith(trace, 5, 'T4', true);
      }
    }
    return rejectWith(trace, 4, 'Low velocity — sold fewer than 4 times in 90 days',
      `sales_rank_drops_90=${rankDrops90}`);
  }

  // 4c: Tier lookup + walking. Primary signal is rank drops; BSR ceiling
  // is the secondary gate per Matt's spec clarification.
  const tiers = tt.getTiersForCategory(category);
  if (!tiers || tiers.length === 0) {
    // Should never happen in production — every detectCategory output
    // has a matching seed row in tier_thresholds. Kept as a safety net.
    return rejectWith(trace, 4, 'Category not accepted', `no_tiers_for:${category}`);
  }

  // Walk tiers from strictest (T1) to loosest, assign first one we qualify for.
  // BSR is the secondary gate per Matt: rank drops primary, BSR as ceiling.
  let assignedTier = null;
  for (const tier of tiers) {
    if (rankDrops90 >= tier.min_rank_drops_90) {
      // Secondary BSR gate
      if (extractedFields.current_bsr != null &&
          extractedFields.current_bsr > tier.bsr_ceiling) {
        // Too deep in this tier's BSR range — try a lower tier
        continue;
      }
      assignedTier = tier;
      break;
    }
  }

  if (!assignedTier) {
    // Could be below min_rank_drops_90 threshold or BSR exceeded every tier
    return rejectWith(trace, 4, 'Below all tier thresholds',
      `drops90=${rankDrops90} bsr=${extractedFields.current_bsr}`);
  }
  trace.tier_assigned = assignedTier.tier;

  // ===== STEP 5: Price determination (the spec §4.1 rule 1 change) =====
  // Uses USED buy box (Keepa index 32), not new buy box — this is a used-media buyback.
  const currentPrice = extractedFields.current_used_buybox_cents ?? extractedFields.current_new_3p_cents;
  const avgPrice     = extractedFields.avg_90_day_used_buybox_cents;

  if (currentPrice == null || currentPrice <= 0) {
    return rejectWith(trace, 5, 'No active price');
  }
  if (avgPrice == null || avgPrice <= 0) {
    return rejectWith(trace, 5, 'Insufficient price history');
  }

  const volatility = Math.abs(currentPrice - avgPrice) / avgPrice;
  trace.volatility_ratio = volatility;

  if (volatility > 0.30) {
    return rejectWith(trace, 5, 'Price too volatile',
      `volatility_ratio=${volatility.toFixed(3)}`);
  }

  const workingPrice = Math.min(currentPrice, avgPrice);
  trace.working_price_cents = workingPrice;
  trace.working_price_source = (workingPrice === currentPrice) ? 'current_buybox' : 'avg_90_day';

  const minPrice = CATEGORY_MIN_PRICE_CENTS[category];
  if (workingPrice < minPrice) {
    return rejectWith(trace, 5, 'Sell price too low for viable margin',
      `working_price=${workingPrice} min=${minPrice}`);
  }

  // ===== STEP 6: Competition check (simplified) =====
  // Amazon-on-listing logic was REMOVED on 2026-04-10. CleanSlate sells
  // used inventory and prices against Keepa index 32 (used buy box).
  // Amazon almost always competes on the NEW buy box, not the used one,
  // so penalizing the used-side offer based on new-side competition was
  // logically inconsistent. The residual Amazon risk (Amazon crashes new
  // price -> crashes used price) is already caught by Step 5's 30%
  // volatility gate and Step 4's velocity floor — both fire the moment
  // the used-side numbers move. Inventory cap (10/ASIN) limits lag
  // exposure.
  //
  // extractedFields.amazon_is_seller is still extracted and stored in
  // trace.keepa_fields for debugger visibility but no longer gates or
  // penalizes anything here.
  let competitionPenalty = 1.0;
  if (extractedFields.fba_offer_count > 30 && workingPrice < 500) {
    return rejectWith(trace, 6, 'Too competitive, low price');
  } else if (extractedFields.fba_offer_count > 50) {
    competitionPenalty = 0.90;
  }
  trace.competition_penalty_applied = competitionPenalty;

  // ===== STEP 7: Fee calculation =====
  const referralRate     = tt.getConfig('referral_fee_rate');
  const closingFee       = tt.getConfig('closing_fee_cents');
  const prepCost         = tt.getConfig('prep_cost_cents');
  const inboundPerLb     = tt.getConfig('inbound_per_lb_cents');
  const mediaMailReceive = tt.getConfig('media_mail_receive_cents');
  const discBufferCfg    = tt.getConfig('disc_buffer_cents');
  const rejectionReturn  = tt.getConfig('rejection_return_overhead_cents');
  const storageReserve   = tt.getConfig('storage_reserve_cents');

  const referralFee = Math.floor(workingPrice * referralRate);

  const fbaFulfillmentFee = lookupFBAFee(extractedFields.package_weight_g);

  const weightLbs = extractedFields.package_weight_g / 453.592;
  const inboundShipping = Math.max(25, Math.floor(weightLbs * inboundPerLb));

  const discBuffer = ['dvd', 'bluray', 'cd', 'game'].includes(category) ? discBufferCfg : 0;

  const totalFees = referralFee + closingFee + fbaFulfillmentFee + prepCost +
                    inboundShipping + mediaMailReceive + discBuffer +
                    rejectionReturn + storageReserve;

  trace.fees_breakdown = {
    referral_fee_cents:             referralFee,
    closing_fee_cents:              closingFee,
    fba_fulfillment_fee_cents:      fbaFulfillmentFee,
    prep_cost_cents:                prepCost,
    inbound_shipping_cents:         inboundShipping,
    media_mail_receive_cents:       mediaMailReceive,
    disc_buffer_cents:              discBuffer,
    rejection_return_overhead_cents: rejectionReturn,
    storage_reserve_cents:          storageReserve,
    total_fees_cents:               totalFees,
  };

  // ===== STEP 8: Net resale value =====
  const netResale = workingPrice - totalFees;
  trace.net_resale_cents = netResale;

  if (netResale <= 0) {
    // Amazon math is underwater — but the item might still work in an eBay
    // genre bundle where there are NO per-item Amazon fees. A lot of 25
    // horror DVDs sells for $15-30 on eBay. The per-item economics are:
    //   revenue: ~$0.60-$1.20 per item (lot price / item count)
    //   eBay fee: ~13% = ~$0.08-$0.16
    //   shipping: amortized across box (~$0.09/item in a 60-item box)
    //   net per item: ~$0.40-$0.90
    // So $0.05 acquisition cost is viable if per-item net >= $0.25.
    //
    // We use the working price as a proxy for the item's eBay value in a
    // bundle. Items with higher Amazon prices will have higher eBay bundle
    // value too. The threshold: working_price >= $2.00 means the item has
    // SOME resale value and belongs in a genre lot, not the trash.
    const EBAY_BUNDLE_MIN_PRICE_CENTS = 200; // $2.00 minimum to be worth bundling
    const EBAY_BUNDLE_OFFER_CENTS = 5;        // $0.05

    if (workingPrice >= EBAY_BUNDLE_MIN_PRICE_CENTS) {
      const subCat = classifySubCategory(category, extractedFields.title);
      if (!subCat.reject) {
        trace.final_offer_cents = EBAY_BUNDLE_OFFER_CENTS;
        trace.penny_tier_applied = true;
        trace.penny_offer_cents = EBAY_BUNDLE_OFFER_CENTS;
        trace.penny_net_profit_cents = null; // not calculable per-item for eBay bundles
        trace.sub_category = subCat.subCategory;
        trace.genre = subCat.genre || null;
        trace.disposition = 'ebay_bundle';
        trace.bundle_label = subCat.bundleLabel || formatBundleLabel(category, subCat.genre || 'mixed');
        trace.ebay_fallback = true;
        return acceptWith(trace, EBAY_BUNDLE_OFFER_CENTS, assignedTier?.tier || 'T4', true);
      }
    }

    return rejectWith(trace, 8, 'No margin after fees');
  }

  // ===== STEP 9: Inventory throttling (MVP: always 1.00) =====
  // Phase 2 wires actual inventory_on_hand throttling.
  trace.inventory_penalty_applied = 1.0;

  // ===== STEP 10: ROI floor + final offer =====
  const roiFloor = assignedTier.roi_floor_percent / 100;
  trace.roi_floor_applied = assignedTier.roi_floor_percent;

  const maxOfferCents = Math.floor(netResale / (1 + roiFloor));
  const requiredMargin = Math.max(
    assignedTier.min_flat_margin_cents,
    netResale - maxOfferCents
  );
  trace.required_margin_cents = requiredMargin;

  const offerBeforePenalties = netResale - requiredMargin;
  const withPenalties = offerBeforePenalties * competitionPenalty * trace.inventory_penalty_applied;
  const finalOffer = Math.floor(withPenalties / 5) * 5; // round down to nearest $0.05
  trace.final_offer_cents = finalOffer;

  // ===== STEP 11: Sanity checks + sub-category penny tier =====
  if (finalOffer < 25) {
    // V2: classify sub-category to determine penny offer ($0.10 keeper vs
    // $0.05 bulk) and check for reject sub-categories (romance, sports games, etc.)
    const subCat = classifySubCategory(category, extractedFields.title);
    trace.sub_category = subCat.subCategory;
    trace.genre = subCat.genre || null;
    trace.disposition = subCat.disposition || null;
    trace.bundle_label = subCat.bundleLabel || null;

    if (subCat.reject) {
      return rejectWith(trace, 11, subCat.rejectReason,
        `sub_category=${subCat.subCategory}`);
    }

    const pennyProfit = netResale - subCat.pennyOffer;
    if (pennyProfit >= subCat.minNetProfit) {
      trace.final_offer_cents = subCat.pennyOffer;
      trace.penny_tier_applied = true;
      trace.penny_offer_cents = subCat.pennyOffer;
      trace.penny_net_profit_cents = pennyProfit;
      return acceptWith(trace, subCat.pennyOffer, assignedTier.tier, true);
    }
    return rejectWith(trace, 11, 'Margin too thin',
      `final_offer=${finalOffer}, penny=${subCat.pennyOffer}, penny_profit=${pennyProfit}`);
  }
  if (finalOffer > workingPrice * 0.50) {
    console.error('[offerEngine] Calculation error — offer exceeds 50% of working price', {
      asin: extractedFields.asin, workingPrice, finalOffer,
    });
    return rejectWith(trace, 11, 'Engine calculation error',
      `offer=${finalOffer} > 50%_of_${workingPrice}`);
  }

  trace.penny_tier_applied = false;
  trace.sub_category = null;
  return acceptWith(trace, finalOffer, assignedTier.tier, false);
}

// ------------------------------------------------------------
// Legacy wrapper — preserves the old calculateOffer() signature
// so existing routes (quote.js, admin.js) keep working without
// modification beyond the engine refactor itself.
//
// Builds a legacy _debug payload from the new calculation_trace.
// ------------------------------------------------------------

/**
 * @deprecated condition param — retained for API compatibility.
 * The engine now uses blended buybox pricing per spec §4.1.
 * This parameter is ignored and will be removed in a future sprint.
 *
 * @deprecated pricingMode param — same story. The old scouting vs buyback
 * bifurcation is gone; the engine produces a single spec-compliant offer.
 *
 * TODO: Remove condition and pricingMode params after all callers updated
 * (tracked for cleanup sprint).
 */
function calculateOffer(product, hasCase = true, pricingMode = 'buyback', condition = null, _precomputed = null) {
  if (pricingMode && pricingMode !== 'buyback') warnDeprecated('pricingMode', pricingMode);
  if (condition != null) warnDeprecated('condition', condition);

  // Accept precomputed engine result to avoid running the 11-step algorithm twice.
  // Callers that already ran runOfferEngine() pass { extracted, gatedResult, engineResult }.
  const extracted = _precomputed?.extracted || extractKeepaFields(product);
  const gatedResult = _precomputed?.gatedResult || isGated(product);
  const result = _precomputed?.engineResult || runOfferEngine(product, extracted, { gatedResult });

  const category = extracted.category_root || result.calculation_trace?.category || null;
  const isDisc = ['dvd', 'bluray', 'cd', 'game'].includes(category);

  const meta = {
    title: product.title || 'Unknown Item',
    asin: extracted.asin,
    imageUrl: product.imagesCSV
      ? `https://images-na.ssl-images-amazon.com/images/I/${product.imagesCSV.split(',')[0]}`
      : null,
    category,
    isDisc,
    hasCase,
  };

  // Build legacy _debug shape that admin.js reads.
  // Fields admin.js uses: sellPrice, priceSource, fees, profitAnalysis, velocity, weightLbs
  const trace = result.calculation_trace;
  const _debug = buildLegacyDebug(trace, extracted, result);

  if (!result.accepted) {
    return {
      ...meta,
      status: 'rejected',
      reason: result.rejection_reason || 'unknown',
      message: humanizeRejection(result.rejection_reason),
      offerCents: 0,
      offerDisplay: '$0.00',
      _debug,
    };
  }

  const offerCents = result.offer_cents;
  let status, color, label;
  const bundleLabel = trace?.bundle_label || null;

  if (result.is_penny_tier) {
    status = 'penny'; color = 'amber';
    label = bundleLabel
      ? `Bulk Add — ${bundleLabel}`
      : `Bulk Add $${(offerCents / 100).toFixed(2)}`;
  } else if (offerCents >= 150) {
    status = 'accepted'; color = 'green'; label = "We'll Buy This!";
  } else {
    status = 'low'; color = 'yellow'; label = 'Low Offer';
  }

  return {
    ...meta,
    status,
    color,
    label,
    offerCents,
    offerDisplay: `$${(offerCents / 100).toFixed(2)}`,
    tier: result.tier,
    genre: trace?.genre || null,
    bundleLabel: bundleLabel,
    _debug,
  };
}

function buildLegacyDebug(trace, extracted, result) {
  const fees = trace.fees_breakdown || {};
  const workingPrice = trace.working_price_cents;
  const netResale = trace.net_resale_cents;
  const finalOffer = trace.final_offer_cents || 0;

  // Rough ROI for display (admin profit panel)
  const ourProfit = netResale != null && finalOffer > 0
    ? netResale - finalOffer
    : 0;
  const roi = finalOffer > 0 ? Math.round((ourProfit / finalOffer) * 100) : 0;
  const profitMargin = workingPrice && workingPrice > 0 && ourProfit != null
    ? Math.round((ourProfit / workingPrice) * 100)
    : 0;

  return {
    // Legacy fields admin.js reads
    sellPrice: workingPrice,
    priceSource: trace.working_price_source
      ? { selected: trace.working_price_source, selectedPrice: workingPrice }
      : null,
    weightLbs: extracted.package_weight_g != null
      ? Math.round((extracted.package_weight_g / 453.592) * 100) / 100
      : null,
    keepaFbaFee: fees.fba_fulfillment_fee_cents ?? null,
    fees: {
      referralFee:   fees.referral_fee_cents ?? 0,
      closingFee:    fees.closing_fee_cents ?? 0,
      fbaFee:        fees.fba_fulfillment_fee_cents ?? 0,
      prepFee:       fees.prep_cost_cents ?? 0,
      inboundShip:   fees.inbound_shipping_cents ?? 0,
      customerShip:  fees.media_mail_receive_cents ?? 0,
      discBuffer:    fees.disc_buffer_cents ?? 0,
      amazonFees: (fees.referral_fee_cents ?? 0) + (fees.closing_fee_cents ?? 0) + (fees.fba_fulfillment_fee_cents ?? 0),
      ourCosts: (fees.prep_cost_cents ?? 0) + (fees.inbound_shipping_cents ?? 0) + (fees.media_mail_receive_cents ?? 0) + (fees.disc_buffer_cents ?? 0) + (fees.rejection_return_overhead_cents ?? 0) + (fees.storage_reserve_cents ?? 0),
      profitPool: netResale,
      totalDeductions: workingPrice != null ? workingPrice - finalOffer : null,
    },
    profitAnalysis: {
      ourProfit,
      roi,
      roiFloor: trace.roi_floor_applied,
      profitMargin,
      buySignal: result.accepted ? 'BUY' : 'PASS',
      meetsTargetProfit: result.accepted,
      meetsROI: result.accepted,
      requiredMarginCents: trace.required_margin_cents,
    },
    velocity: {
      salesRankDrops90: extracted.sales_rank_drops_90,
      salesRankDrops180: extracted.sales_rank_drops_180,
      salesRankDrops30: extracted.sales_rank_drops_30,
      salesRank: extracted.current_bsr,
      source: 'sales_rank_drops_90',
    },
    competitionAdjustment: {
      fbaOfferCount: extracted.fba_offer_count,
      amazonOnListing: extracted.amazon_is_seller,
      penaltyApplied: trace.competition_penalty_applied,
    },
    // Full trace (for quote_items logging + future Quote Debugger)
    calculation_trace: trace,
    rejection_step: trace.rejection_step,
  };
}

// Map internal rejection reasons to customer-friendly messages.
// If the reason is already a full customer-facing sentence (ends in a
// period), we pass it through unchanged — that's the case for the new
// Step 1 and Step 4 category-gate messages.
function humanizeRejection(reason) {
  if (!reason) return "Sorry, we can't make an offer on this item right now.";
  // Pass-through for reasons that are already full customer sentences
  // (the new Step 1 barcode-not-recognized message ends in a period).
  if (/[.!?]$/.test(reason)) return reason;
  const map = {
    'We only buy books, DVDs, Blu-rays, CDs, and video games':
      'Sorry, we only buy books, DVDs, Blu-rays, CDs, and video games.',
    'Insufficient recent data': "Sorry, we don't have enough recent data on this item.",
    'Hazmat restricted': 'Sorry, we cannot accept hazmat items.',
    'Adult content restricted': 'Sorry, we do not accept adult content.',
    'Listing deprecated': "Sorry, the listing for this item is no longer active.",
    'Insufficient product data': "Sorry, we don't have enough data on this item.",
    'Oversize': 'Sorry, this item is too large for our shipping program.',
    'Overweight': 'Sorry, this item is too heavy for our shipping program.',
    'Category not accepted': 'Sorry, we only accept books, DVDs, Blu-rays, CDs, and video games.',
    'Item on cooldown list': "Sorry, we can't accept this item right now.",
    'We have enough of this item right now': "Sorry, we have enough of this item right now.",
    'Low velocity — sold fewer than 4 times in 90 days': "Sorry, there's not enough demand for this item.",
    'Below all tier thresholds': "Sorry, there's not enough demand for this item.",
    'No active price': "Sorry, we can't find a current price for this item.",
    'Insufficient price history': "Sorry, we don't have enough pricing history on this item.",
    'Price too volatile': "Sorry, this item's price is too unstable right now.",
    'Sell price too low for viable margin': 'Sorry, the resale value is too low.',
    'Too competitive, low price': "Sorry, this item is too competitive.",
    'No margin after fees': 'Sorry, the resale value is too low for us to make an offer.',
    'Margin too thin': 'Sorry, the resale value is too low for us to make an offer.',
    'Engine calculation error': "Sorry, we hit an error pricing this item. Please try again.",
  };
  return map[reason] || "Sorry, we can't accept this item.";
}

// ------------------------------------------------------------
// Removed-exports stubs — throw loudly so forgotten callers surface
// ------------------------------------------------------------
function _removed(name) {
  return () => {
    throw new Error(
      `[offerEngine] ${name}() was removed in the 2026-04-10 spec alignment refactor. ` +
      `Use runOfferEngine() or calculateOffer() instead. See docs/CLEANSLATE_DB_AND_ENGINE.md.`
    );
  };
}

module.exports = {
  // New spec-aligned exports
  runOfferEngine,
  extractKeepaFields,
  detectCategory,
  isGated,
  lookupFBAFee,
  classifySubCategory,
  detectGenre,
  newTrace,
  CATEGORY_BLACKLIST,
  CATEGORY_MIN_PRICE_CENTS,
  GATED_ASINS,
  GATED_BRAND_PATTERNS,

  // Legacy wrapper still working (admin.js + quote.js)
  calculateOffer,

  // Removed — throw on call
  getTrigger:           _removed('getTrigger'),
  getSellPriceSource:   _removed('getSellPriceSource'),
  getSlotPrice:         _removed('getSlotPrice'),
  getUsedSlotPrice:     _removed('getUsedSlotPrice'),
  getAllConditionPrices:_removed('getAllConditionPrices'),
  getAverageUsedPrice:  _removed('getAverageUsedPrice'),
  getFbaUsedAvgPrice:   _removed('getFbaUsedAvgPrice'),
  getTargetProfit:      _removed('getTargetProfit'),
  getVelocity:          _removed('getVelocity'),
  getFbaFee:            _removed('getFbaFee'),
  getKeepaFbaFee:       _removed('getKeepaFbaFee'),
  getMediaMailCost:     _removed('getMediaMailCost'),
  getSellPrice:         _removed('getSellPrice'),
  TRIGGERS:             null, // consumers reading TRIGGERS will get null and can be updated to getTiersForCategory
};

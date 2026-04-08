// All prices in CENTS (integers)

// Fee stack constants
const REFERRAL_RATE = 0.15;
const CLOSING_FEE = 180;          // $1.80
const BUY_COST = 22;              // $0.22
const PREP_FEE = 145;             // $1.45
const INBOUND_SHIP_PER_LB = 50;   // $0.50/lb
const DISC_BUFFER = 50;           // $0.50 for disc items only
const DEFAULT_WEIGHT_GRAMS = 400;

// FBA fulfillment fee by weight
function getFbaFee(weightLbs) {
  if (weightLbs <= 0.5) return 306;
  if (weightLbs <= 1.0) return 340;
  if (weightLbs <= 1.5) return 375;
  if (weightLbs <= 2.0) return 420;
  if (weightLbs <= 3.0) return 475;
  return 475 + Math.ceil((weightLbs - 3) * 50);
}

// Media Mail shipping cost
function getMediaMailCost(weightLbs) {
  if (weightLbs <= 1) return 349;
  if (weightLbs <= 2) return 398;
  if (weightLbs <= 3) return 447;
  if (weightLbs <= 4) return 496;
  return 545;
}

// ============================================================
// CATEGORY DETECTION
// ============================================================

const CATEGORY_MAP = {
  283155: 'book',
  163856011: 'dvd',
  2625373011: 'dvd',
  5174: 'cd',
  468642: 'game',
  11846801: 'game',
};

function detectCategory(product) {
  const rootCat = product.rootCategory;
  if (CATEGORY_MAP[rootCat]) return CATEGORY_MAP[rootCat];

  const tree = product.categoryTree || [];
  const names = tree.map(c => (c.name || '').toLowerCase()).join(' ');
  if (/book|textbook/.test(names)) return 'book';
  if (/movie|dvd|blu-ray/.test(names)) return 'dvd';
  if (/music|cd/.test(names)) return 'cd';
  if (/video game|nintendo|playstation|xbox/.test(names)) return 'game';

  return null;
}

// ============================================================
// TRIGGER TABLES — full scouting tool config per tier
// Each tier: { maxRank, fbaSlot, usedSlot, selectBBifLower, selectBBifHigher,
//              offNewBB, offAmazon, targetProfit (cents), reject }
// ============================================================

// tier: 1=Lightning, 2=Fast, 3=Steady, 4=Slow
// profitFloor: minimum $ profit we need (in cents) — below this, reject
// rejectIfAmazon: if true, reject when Amazon is a seller on this listing (can't compete on slow items)
const TRIGGERS = {
  book: [
    { tier: 1, maxRank: 500000,   fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.05, targetProfit: 250, roiFloor: 30, profitFloor: 200, rejectIfAmazon: false },
    { tier: 2, maxRank: 1000000,  fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.05, targetProfit: 350, roiFloor: 50, profitFloor: 300, rejectIfAmazon: false },
    { tier: 3, maxRank: 2000000,  fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.10, targetProfit: 500, roiFloor: 75, profitFloor: 400, rejectIfAmazon: true },
    { tier: 4, maxRank: 6000000,  fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.10, targetProfit: 800, roiFloor: 150, profitFloor: 600, rejectIfAmazon: true },
    { maxRank: Infinity, reject: true },
  ],
  dvd: [
    { tier: 1, maxRank: 50000,    fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.05, targetProfit: 250, roiFloor: 30, profitFloor: 200, rejectIfAmazon: false },
    { tier: 2, maxRank: 100000,   fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.10, targetProfit: 350, roiFloor: 50, profitFloor: 300, rejectIfAmazon: false },
    { tier: 3, maxRank: 200000,   fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.10, targetProfit: 500, roiFloor: 75, profitFloor: 400, rejectIfAmazon: true },
    { tier: 4, maxRank: 250000,   fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.10, targetProfit: 650, roiFloor: 150, profitFloor: 600, rejectIfAmazon: true },
    { maxRank: Infinity, reject: true },
  ],
  cd: [
    { tier: 1, maxRank: 50000,    fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.05, targetProfit: 250, roiFloor: 30, profitFloor: 200, rejectIfAmazon: false },
    { tier: 2, maxRank: 100000,   fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.10, targetProfit: 350, roiFloor: 50, profitFloor: 300, rejectIfAmazon: false },
    { tier: 3, maxRank: 200000,   fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.10, targetProfit: 500, roiFloor: 75, profitFloor: 400, rejectIfAmazon: true },
    { tier: 4, maxRank: 250000,   fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.10, targetProfit: 650, roiFloor: 150, profitFloor: 600, rejectIfAmazon: true },
    { maxRank: Infinity, reject: true },
  ],
  game: [
    { tier: 1, maxRank: 100000,   fbaSlot: 1, usedSlot: 3, selectBBifLower: false, selectBBifHigher: true,  offNewBB: 0.05, offAmazon: 0.10, targetProfit: 350, roiFloor: 30, profitFloor: 200, rejectIfAmazon: false },
    { maxRank: Infinity, reject: true },
  ],
};

// Find the matching trigger tier for a category + rank
function getTrigger(category, salesRank) {
  if (!salesRank || salesRank <= 0) return null;
  const tiers = TRIGGERS[category];
  if (!tiers) return null;
  for (const tier of tiers) {
    if (salesRank <= tier.maxRank) return tier;
  }
  return null;
}

// Legacy wrapper
function getTargetProfit(category, salesRank) {
  const trigger = getTrigger(category, salesRank);
  if (!trigger || trigger.reject) return null;
  return trigger.targetProfit;
}

// ============================================================
// VELOCITY METRICS
// ============================================================

function getVelocity(product, category) {
  const salesRank = getSalesRank(product);
  const stats = product.stats || {};

  // Use Keepa's actual rank drops when available (from stats=180 param)
  const rankDrops30 = stats.salesRankDrops30 ?? null;
  const rankDrops90 = stats.salesRankDrops90 ?? null;
  const rankDrops180 = stats.salesRankDrops180 ?? null;

  // Best monthly sales estimate: rank drops 30d is the most reliable
  // monthlySoldHistory can be stale (contains -1 values meaning data stopped)
  let monthlySales = null;
  let source = 'rank_estimate';

  // Primary: rank drops in last 30 days (each drop ≈ 1 sale)
  if (rankDrops30 != null && rankDrops30 > 0) {
    monthlySales = rankDrops30;
    source = 'rank_drops_30d';
  }

  // Fallback: monthlySoldHistory — but only if the latest value is > 0 (not -1/stale)
  if (monthlySales === null) {
    const history = product.monthlySoldHistory;
    if (history && history.length >= 2) {
      const lastVal = history[history.length - 1];
      if (lastVal > 0) {
        monthlySales = lastVal;
        source = 'keepa_monthly_sold';
      }
    }
  }

  // Fallback: estimate from rank + category
  if (monthlySales === null && salesRank > 0) {
    if (category === 'book') {
      if (salesRank <= 50000) monthlySales = 60;
      else if (salesRank <= 100000) monthlySales = 30;
      else if (salesRank <= 500000) monthlySales = 10;
      else if (salesRank <= 1000000) monthlySales = 3;
      else if (salesRank <= 2000000) monthlySales = 1;
      else monthlySales = 0;
    } else if (category === 'dvd' || category === 'cd') {
      if (salesRank <= 25000) monthlySales = 20;
      else if (salesRank <= 50000) monthlySales = 10;
      else if (salesRank <= 100000) monthlySales = 5;
      else if (salesRank <= 200000) monthlySales = 2;
      else monthlySales = 0;
    } else if (category === 'game') {
      if (salesRank <= 25000) monthlySales = 15;
      else if (salesRank <= 50000) monthlySales = 8;
      else if (salesRank <= 100000) monthlySales = 3;
      else monthlySales = 0;
    } else {
      monthlySales = 0;
    }
  }

  // Sales rank averages from stats
  const rankAvg30 = stats.avg30?.[3] > 0 ? stats.avg30[3] : null;
  const rankAvg90 = stats.avg90?.[3] > 0 ? stats.avg90[3] : null;
  const rankAvg180 = stats.avg180?.[3] > 0 ? stats.avg180[3] : null;

  let velocityTier, velocityLabel;
  if (monthlySales >= 20) { velocityTier = 'fast'; velocityLabel = 'Fast Seller'; }
  else if (monthlySales >= 5) { velocityTier = 'medium'; velocityLabel = 'Medium Seller'; }
  else if (monthlySales >= 1) { velocityTier = 'slow'; velocityLabel = 'Slow Seller'; }
  else { velocityTier = 'very_slow'; velocityLabel = 'Very Slow'; }

  return {
    monthlySales, velocityTier, velocityLabel, salesRank, source,
    rankDrops30, rankDrops90, rankDrops180,
    rankAvg30, rankAvg90, rankAvg180,
  };
}

// ============================================================
// PRICE SELECTION
// ============================================================

function getCurrentValue(csvArray) {
  if (!csvArray || csvArray.length < 2) return -1;
  return csvArray[csvArray.length - 1];
}

// Get the Nth-cheapest offer from Keepa offers array, filtered by type and condition
// type: 'used' = conditions 2-5, 'fba' = FBA used only
// condition: 'like_new' (includes VG), 'good', 'acceptable', or null for all
function getSlotPrice(product, slot, type = 'used', condition = null) {
  const offers = product.offers;
  if (!offers || !Array.isArray(offers) || offers.length === 0 || slot === null) return -1;

  // Build allowed condition set
  // new_sealed uses Keepa condition 1 (New)
  let allowedConditions = null;
  if (condition === 'new_sealed') allowedConditions = [1];
  else if (condition === 'like_new') allowedConditions = [2, 3];
  else if (condition === 'good') allowedConditions = [4];
  else if (condition === 'acceptable') allowedConditions = [5];

  const prices = [];
  for (const offer of offers) {
    // For new_sealed (condition 1), allow it; for used, require condition 2-5
    if (allowedConditions) {
      if (!allowedConditions.includes(offer.condition)) continue;
    } else {
      if (offer.condition < 2 || offer.condition > 5) continue;
    }
    if (type === 'fba' && !offer.isFBA) continue;

    const csv = offer.offerCSV;
    if (!csv || csv.length < 2) continue;

    let price = -1;
    for (let i = csv.length - 2; i >= 1; i -= 3) {
      if (csv[i] > 0) { price = csv[i]; break; }
    }
    if (price <= 0) continue;
    prices.push(price);
  }

  if (prices.length === 0) return -1;
  prices.sort((a, b) => a - b);
  const idx = Math.min(slot - 1, prices.length - 1);
  return prices[idx];
}

// Legacy alias
function getUsedSlotPrice(product, slot = 3) {
  return getSlotPrice(product, slot, 'used');
}

// Full sell price selection using scouting tool trigger logic:
// 1. Get FBA Slot N price (Nth cheapest FBA used offer)
// 2. Get Used Slot N price (Nth cheapest used offer overall)
// 3. Base price = higher of FBA Slot and Used Slot
// 4. If selectBBifHigher and Used Buy Box > base → use Buy Box
// 5. If selectBBifLower is false and Buy Box < base → ignore Buy Box
// 6. Cap at: min(price, New3P × (1 - offNewBB), Amazon × (1 - offAmazon))
function getSellPriceSource(product, hasCase = true, trigger = null, condition = null) {
  const csv = product.csv || [];

  // Raw price data
  const usedBuyBox = csv[17] ? getCurrentValue(csv[17]) : -1;
  const lowestUsed = csv[2] ? getCurrentValue(csv[2]) : -1;
  const usedVeryGood = csv[10] ? getCurrentValue(csv[10]) : -1;
  const usedGood = csv[11] ? getCurrentValue(csv[11]) : -1;
  const new3p = csv[1] ? getCurrentValue(csv[1]) : -1;
  const amazon = csv[0] ? getCurrentValue(csv[0]) : -1;

  const offers = product.offers || [];
  const usedOffers = offers.filter(o => o.condition >= 2 && o.condition <= 5);
  const fbaOffers = offers.filter(o => o.condition >= 2 && o.condition <= 5 && o.isFBA);

  // Slot prices from offers array
  const fbaSlot = trigger?.fbaSlot;
  const usedSlot = trigger?.usedSlot;
  const fbaSlotPrice = fbaSlot ? getSlotPrice(product, fbaSlot, 'fba') : -1;
  const usedSlotPrice = usedSlot ? getSlotPrice(product, usedSlot, 'used') : -1;

  // Average used (condition-filtered when provided)
  const avgUsed = getAverageUsedPrice(product, condition);

  let selected = null;
  let selectedPrice = -1;
  let preCap = -1;

  // Step 1: Base price = higher of FBA Slot and Used Slot
  let basePrice = -1;
  let baseSource = null;
  if (fbaSlotPrice > 0 && usedSlotPrice > 0) {
    if (fbaSlotPrice >= usedSlotPrice) { basePrice = fbaSlotPrice; baseSource = 'fbaSlot'; }
    else { basePrice = usedSlotPrice; baseSource = 'usedSlot'; }
  } else if (fbaSlotPrice > 0) {
    basePrice = fbaSlotPrice; baseSource = 'fbaSlot';
  } else if (usedSlotPrice > 0) {
    basePrice = usedSlotPrice; baseSource = 'usedSlot';
  }

  // Step 2: Apply Used Buy Box selection rules
  if (basePrice > 0 && usedBuyBox > 0 && trigger) {
    if (trigger.selectBBifHigher && usedBuyBox > basePrice) {
      basePrice = usedBuyBox;
      baseSource = 'usedBuyBox_higher';
    }
    // selectBBifLower: false means we ignore Buy Box when lower (already handled by not using it)
  }

  if (basePrice > 0) {
    selected = baseSource;
    selectedPrice = basePrice;
  }

  // Fallback chain if no slot prices available
  if (selectedPrice <= 0 && avgUsed > 0) {
    selected = 'averageUsed';
    selectedPrice = avgUsed;
  }
  if (selectedPrice <= 0 && lowestUsed > 0) {
    selected = 'lowestUsed';
    selectedPrice = lowestUsed;
  }
  if (selectedPrice <= 0 && new3p > 0) {
    selected = 'new3p_estimated';
    selectedPrice = Math.round(new3p * 0.60);
  }

  preCap = selectedPrice;

  // Step 3: Apply price ceilings (% Off New BB, % Off Amazon)
  if (selectedPrice > 0 && trigger) {
    if (new3p > 0 && trigger.offNewBB > 0) {
      const newCap = Math.round(new3p * (1 - trigger.offNewBB));
      if (selectedPrice > newCap) {
        selectedPrice = newCap;
        selected = selected + '_capped_new';
      }
    }
    if (amazon > 0 && trigger.offAmazon > 0) {
      const amazonCap = Math.round(amazon * (1 - trigger.offAmazon));
      if (selectedPrice > amazonCap) {
        selectedPrice = amazonCap;
        selected = selected + '_capped_amazon';
      }
    }
  }

  // Apply case adjustment
  const finalPrice = hasCase ? selectedPrice : Math.round(selectedPrice * 0.75);

  return {
    selected,
    selectedPrice: finalPrice,
    rawSelectedPrice: selectedPrice,
    preCap: preCap !== selectedPrice ? preCap : null,
    candidates: {
      buyBoxUsed90: (product.stats?.avg90?.[32] > 0) ? product.stats.avg90[32] : null,
      buyBoxUsed180: (product.stats?.avg180?.[32] > 0) ? product.stats.avg180[32] : null,
      fbaSlotPrice: fbaSlotPrice > 0 ? fbaSlotPrice : null,
      fbaUsedAvg: getFbaUsedAvgPrice(product) > 0 ? getFbaUsedAvgPrice(product) : null,
      usedSlotPrice: usedSlotPrice > 0 ? usedSlotPrice : null,
      averageUsed: avgUsed > 0 ? avgUsed : null,
      usedBuyBox: usedBuyBox > 0 ? usedBuyBox : null,
      lowestUsed: lowestUsed > 0 ? lowestUsed : null,
      usedVeryGood: usedVeryGood > 0 ? usedVeryGood : null,
      usedGood: usedGood > 0 ? usedGood : null,
      new3p: new3p > 0 ? new3p : null,
      newCap: new3p > 0 && trigger?.offNewBB ? Math.round(new3p * (1 - trigger.offNewBB)) : null,
      amazon: amazon > 0 ? amazon : null,
      amazonCap: amazon > 0 && trigger?.offAmazon ? Math.round(amazon * (1 - trigger.offAmazon)) : null,
    },
    condition: condition || 'all',
    conditionPrices: getAllConditionPrices(product),
    trigger: trigger ? { fbaSlot: trigger.fbaSlot, usedSlot: trigger.usedSlot, offNewBB: trigger.offNewBB, offAmazon: trigger.offAmazon } : null,
    offersCount: offers.length,
    usedOffersCount: usedOffers.length,
    fbaOffersCount: fbaOffers.length,
  };
}

// Get Keepa's actual FBA Pick&Pack fee when available
function getKeepaFbaFee(product) {
  return product.fbaFees?.pickAndPackFee > 0 ? product.fbaFees.pickAndPackFee : null;
}

// Amazon condition codes: 2=LikeNew, 3=VeryGood, 4=Good, 5=Acceptable
const CONDITION_MAP = {
  like_new: 2,
  very_good: 3,
  good: 4,
  acceptable: 5,
};

// Calculate average FBA used price, optionally filtered by condition
// like_new includes both Keepa conditions 2 (Like New) AND 3 (Very Good)
function getFbaUsedAvgPrice(product, conditionFilter = null) {
  const offers = product.offers || [];
  const fbaUsedPrices = [];

  // like_new = Keepa conditions 2 + 3 combined
  let allowedConditions = null;
  if (conditionFilter === 'like_new') {
    allowedConditions = [2, 3]; // Like New + Very Good
  } else if (conditionFilter) {
    allowedConditions = [CONDITION_MAP[conditionFilter]];
  }

  for (const offer of offers) {
    if (offer.condition < 2 || offer.condition > 5 || !offer.isFBA) continue;
    if (allowedConditions && !allowedConditions.includes(offer.condition)) continue;
    const csv = offer.offerCSV;
    if (!csv || csv.length < 2) continue;
    for (let i = csv.length - 2; i >= 1; i -= 3) {
      if (csv[i] > 0) { fbaUsedPrices.push(csv[i]); break; }
    }
  }
  if (fbaUsedPrices.length === 0) return -1;
  return Math.round(fbaUsedPrices.reduce((s, p) => s + p, 0) / fbaUsedPrices.length);
}

// Get all condition-specific prices — FBA Slot 1 per condition
// like_new includes Very Good (merged)
function getAllConditionPrices(product) {
  return {
    new_sealed: getSlotPrice(product, 1, 'fba', 'new_sealed'),
    like_new: getSlotPrice(product, 1, 'fba', 'like_new'),
    good: getSlotPrice(product, 1, 'fba', 'good'),
    acceptable: getSlotPrice(product, 1, 'fba', 'acceptable'),
    all: getSlotPrice(product, 1, 'fba', null),
  };
}

// Get sell price using Keepa data — FBA Slot 1 (lowest FBA offer) per condition
// This is the real competitive price, not inflated by overpriced listings
// Priority: FBA Slot 1 (condition) → FBA Slot 1 (all) → Buy Box Used 90d → Lowest Used
function getAverageUsedPrice(product, condition = null) {
  const stats = product.stats || {};

  // Primary: lowest FBA offer for this specific condition
  if (condition) {
    let slot1 = getSlotPrice(product, 1, 'fba', condition);
    if (slot1 <= 0 && condition === 'new_sealed') {
      slot1 = getSlotPrice(product, 1, 'used', condition);
    }
    if (slot1 > 0) return slot1;
  }

  // Fallback: lowest FBA offer across all conditions
  const slot1All = getSlotPrice(product, 1, 'fba', null);
  if (slot1All > 0) return slot1All;

  // Fallback: Buy Box Used 180-day average (more stable, resists price spikes)
  const buyBoxUsed180 = stats.avg180?.[32];
  if (buyBoxUsed180 > 0) return buyBoxUsed180;

  // Fallback: Buy Box Used 90-day average
  const buyBoxUsed90 = stats.avg90?.[32];
  if (buyBoxUsed90 > 0) return buyBoxUsed90;

  // Fallback: Lowest Used 90-day average from stats
  const lowestUsed90 = stats.avg90?.[2];
  if (lowestUsed90 > 0) return lowestUsed90;

  // Last resort: current Lowest Used
  const csv = product.csv || [];
  const lowestUsed = csv[2] ? getCurrentValue(csv[2]) : -1;
  if (lowestUsed > 500) return lowestUsed;

  return -1;
}

// Main sell price function — uses trigger-based slot pricing with ceilings
function getSellPrice(product, hasCase = true, trigger = null, condition = null) {
  const source = getSellPriceSource(product, hasCase, trigger, condition);
  return source.selectedPrice > 0 ? source.selectedPrice : -1;
}

// ============================================================
// HELPERS
// ============================================================

function getWeightLbs(product) {
  const grams = product.packageWeight || product.itemWeight || DEFAULT_WEIGHT_GRAMS;
  return grams * 0.0022046;
}

function getSalesRank(product) {
  const csv = product.csv || [];
  return getCurrentValue(csv[3]);
}

function getProductMeta(product, category, hasCase) {
  const isDisc = ['dvd', 'cd', 'game'].includes(category);
  return {
    title: product.title || 'Unknown Item',
    asin: product.asin || null,
    imageUrl: product.imagesCSV ? `https://images-na.ssl-images-amazon.com/images/I/${product.imagesCSV.split(',')[0]}` : null,
    category: category || null,
    isDisc,
    hasCase,
  };
}

function cents(v) { return `$${(v / 100).toFixed(2)}`; }

// ============================================================
// MAIN OFFER CALCULATION
// ============================================================

// pricingMode: 'scouting' = FBA Slot trigger logic (admin), 'buyback' = average used (customer)
// condition: 'like_new', 'very_good', 'good', 'acceptable', or null for all
function calculateOffer(product, hasCase = true, pricingMode = 'buyback', condition = null) {
  const category = detectCategory(product);
  const meta = getProductMeta(product, category, hasCase);
  const velocity = getVelocity(product, category);

  if (!category) {
    return { ...meta, status: 'rejected', reason: 'unsupported_category', message: "Sorry, we only accept books, DVDs, CDs, and video games", offerCents: 0, offerDisplay: '$0.00', _debug: { velocity } };
  }

  const salesRank = velocity.salesRank;
  // Use the WORSE of current rank vs 90-day average rank for tier selection
  // This prevents items with a temporary rank spike from getting T1 pricing
  // when they're actually T3/T4 sellers on average
  const rankAvg90 = velocity.rankAvg90;
  const effectiveRank = (rankAvg90 && rankAvg90 > salesRank) ? rankAvg90 : salesRank;
  let trigger = getTrigger(category, effectiveRank);
  if (!trigger || trigger.reject) {
    return { ...meta, status: 'rejected', reason: 'rank_too_high', message: "Sorry, there's not enough demand for this item right now", offerCents: 0, offerDisplay: '$0.00', _debug: { velocity, salesRank, effectiveRank, trigger: trigger || null } };
  }

  // Velocity sanity check using the best available data
  // Amazon's monthlySold (from monthlySoldHistory) is authoritative when available
  // rankDrops30 is the fallback when Amazon data is stale or missing
  const monthlySold = velocity.monthlySales;
  const velocitySource = velocity.source;
  const drops30 = velocity.rankDrops30;
  const tiers = TRIGGERS[category];

  if (velocitySource === 'keepa_monthly_sold' && monthlySold > 0) {
    // Amazon's own data — most trustworthy
    if (monthlySold >= 50 && trigger.tier > 1) {
      // Amazon says 50+/month — promote to T1 (high confidence)
      const t1 = tiers.find(t => t.tier === 1);
      if (t1) trigger = t1;
    } else if (monthlySold < 5 && trigger.tier === 1) {
      // Amazon says < 5/month but rank says T1 — demote to T2
      const t2 = tiers.find(t => t.tier === 2);
      if (t2) trigger = t2;
    } else if (monthlySold < 2 && trigger.tier <= 2) {
      // Amazon says barely selling — demote to T3
      const t3 = tiers.find(t => t.tier === 3);
      if (t3) trigger = t3;
    }
  } else {
    // No Amazon data — use rank drops as fallback
    if (drops30 != null && drops30 < 3 && trigger.tier === 1) {
      const t2 = tiers.find(t => t.tier === 2);
      if (t2) trigger = t2;
    }
    if (drops30 != null && drops30 < 1 && trigger.tier <= 2) {
      const t3 = tiers.find(t => t.tier === 3);
      if (t3) trigger = t3;
      else {
        return { ...meta, status: 'rejected', reason: 'no_recent_sales', message: "Sorry, this item hasn't sold recently enough for us to make an offer", offerCents: 0, offerDisplay: '$0.00', _debug: { velocity, salesRank } };
      }
    }
  }

  const targetProfit = trigger.targetProfit;

  // Check if Amazon is a seller on this listing — reject T3+ items where Amazon competes
  if (trigger.rejectIfAmazon) {
    const amazonPrice = product.csv?.[0] ? getCurrentValue(product.csv[0]) : -1;
    const isAmazonOnListing = amazonPrice > 0;
    if (isAmazonOnListing) {
      return { ...meta, status: 'rejected', reason: 'amazon_on_listing', message: "Amazon is selling this item directly — we can't compete on slower sellers", offerCents: 0, offerDisplay: '$0.00', _debug: { velocity, salesRank, trigger, amazonPrice } };
    }
  }

  // Scouting mode: use FBA Slot / Used Slot trigger-based pricing
  // Buyback mode: use condition-specific FBA average for accurate offers
  const priceSource = pricingMode === 'scouting'
    ? getSellPriceSource(product, hasCase, trigger, condition)
    : getSellPriceSource(product, hasCase, null, condition);
  let sellPrice = priceSource.selectedPrice;
  if (sellPrice <= 0) {
    return { ...meta, status: 'rejected', reason: 'no_price', message: "Sorry, we can't find a current price for this item", offerCents: 0, offerDisplay: '$0.00', _debug: { velocity, priceSource } };
  }

  // Seasonal price check: compare current pricing window vs yearly average
  // If current price is significantly above the yearly average, it's likely a seasonal spike
  // Use the yearly average as a ceiling to avoid overpaying during spikes
  const stats = product.stats || {};
  let seasonalAdjustment = null;
  if (pricingMode === 'buyback') {
    // Compare sell price index across time windows
    // For Buy Box Used (index 32) or Lowest Used (index 2)
    const priceIdx = stats.avg90?.[32] > 0 ? 32 : 2;
    const avg90Price = stats.avg90?.[priceIdx] > 0 ? stats.avg90[priceIdx] : 0;
    const avg365Price = stats.avg365?.[priceIdx] > 0 ? stats.avg365[priceIdx] : 0;

    if (avg90Price > 0 && avg365Price > 0) {
      const ratio = avg90Price / avg365Price;

      if (ratio > 1.3) {
        // Current 90d is 30%+ above yearly average — seasonal spike
        // Cap sell price at the yearly average to be conservative
        const cappedPrice = avg365Price;
        if (sellPrice > cappedPrice) {
          seasonalAdjustment = {
            type: 'spike_cap',
            avg90: avg90Price,
            avg365: avg365Price,
            ratio: Math.round(ratio * 100) / 100,
            originalSellPrice: sellPrice,
            cappedTo: cappedPrice,
          };
          sellPrice = cappedPrice;
        }
      } else if (ratio < 0.7) {
        // Current 90d is 30%+ below yearly average — seasonal dip
        // Price might recover but we're buying in a dip — still use current price but note it
        seasonalAdjustment = {
          type: 'seasonal_dip',
          avg90: avg90Price,
          avg365: avg365Price,
          ratio: Math.round(ratio * 100) / 100,
          note: 'Price is below yearly average — may recover',
        };
        // Don't change sellPrice — we use current market, just flag it
      }
    }
  }

  const weightLbs = getWeightLbs(product);
  const isDisc = meta.isDisc;

  const referralFee = Math.round(sellPrice * REFERRAL_RATE);
  // Use Keepa's actual FBA fee when available, fall back to our weight-based lookup
  const fbaFee = getKeepaFbaFee(product) || getFbaFee(weightLbs);
  const inboundShip = Math.round(weightLbs * INBOUND_SHIP_PER_LB);
  const customerShip = getMediaMailCost(weightLbs);
  const discBuffer = isDisc ? DISC_BUFFER : 0;

  // Amazon fees (taken from revenue)
  const amazonFees = referralFee + CLOSING_FEE + fbaFee;
  // Our operational costs (we pay regardless)
  const ourCosts = PREP_FEE + inboundShip + customerShip + discBuffer;
  // Net revenue after all fees and costs (before customer payout)
  const profitPool = sellPrice - amazonFees - ourCosts;

  const roiFloor = trigger.roiFloor || 30;

  // Competition adjustment: more used sellers = higher profit floor needed
  // Too few sellers (0-1) = price might be artificially high, demote
  // 2-15 = healthy, no change
  // 16-25 = crowded, increase profit floor 25%
  // 25+ = race to bottom, increase profit floor 50%
  const usedSellerCount = priceSource.usedOffersCount || 0;
  let profitFloorMultiplier = 1.0;
  if (usedSellerCount <= 1) {
    // Very few sellers — price might be unreliable/inflated
    // Demote tier if we haven't already
    if (trigger.tier === 1) {
      const t2 = tiers.find(t => t.tier === 2);
      if (t2) trigger = t2;
    }
  } else if (usedSellerCount >= 25) {
    profitFloorMultiplier = 1.5; // 50% higher profit floor
  } else if (usedSellerCount >= 16) {
    profitFloorMultiplier = 1.25; // 25% higher profit floor
  }

  let offer, ourProfit, roi;

  if (pricingMode === 'buyback') {
    // BUYBACK MODE: Customer offer = profitPool / (1 + roiFloor/100)
    // If profit pool is too thin but sell price exists, offer a minimum floor
    // This catches low-value items (cheap CDs, old DVDs) where fees eat the margin
    // but we can still make a few dollars on them
    const MIN_OFFER = 10; // $0.10 minimum — below this, not worth it for anyone

    if (profitPool > 0) {
      offer = Math.floor(profitPool / (1 + roiFloor / 100));
    } else {
      offer = 0;
    }

    if (offer < MIN_OFFER) {
      offer = 0;
    }
    ourProfit = profitPool - offer;
    roi = offer > 0 ? Math.round((ourProfit / offer) * 100) : 0;

    // Profit floor check: ensure we make at least the tier's minimum profit
    // Adjusted by competition — more sellers means we need more buffer
    const profitFloor = Math.round((trigger.profitFloor || 200) * profitFloorMultiplier);
    if (offer > 0 && ourProfit < profitFloor) {
      // Try reducing the offer to meet the profit floor
      const adjustedOffer = profitPool - profitFloor;
      if (adjustedOffer >= MIN_OFFER) {
        offer = adjustedOffer;
        ourProfit = profitFloor;
        roi = offer > 0 ? Math.round((ourProfit / offer) * 100) : 0;
      } else {
        offer = 0; // Can't meet profit floor — reject
      }
    }
  } else {
    // SCOUTING MODE: Fixed target profit, ROI based on buy cost ($0.22)
    offer = sellPrice - amazonFees - ourCosts - BUY_COST - targetProfit;
    ourProfit = sellPrice - amazonFees - ourCosts - BUY_COST;
    roi = BUY_COST > 0 ? Math.round((ourProfit / BUY_COST) * 100) : 0;
  }

  const profitMargin = sellPrice > 0 ? Math.round((ourProfit / sellPrice) * 100) : 0;
  const meetsTargetProfit = offer > 0;
  const meetsROI = roi >= roiFloor;
  const buySignal = (meetsTargetProfit && meetsROI) ? 'BUY' : 'PASS';

  // Build debug payload
  const totalDeductions = sellPrice - offer;
  const _debug = {
    velocity,
    priceSource,
    sellPrice,
    seasonalAdjustment,
    competitionAdjustment: { usedSellerCount, profitFloorMultiplier },
    pricingMode,
    weightLbs: Math.round(weightLbs * 100) / 100,
    keepaFbaFee: getKeepaFbaFee(product),
    fees: {
      referralFee,
      closingFee: CLOSING_FEE,
      fbaFee,
      prepFee: PREP_FEE,
      inboundShip,
      customerShip,
      discBuffer,
      ...(pricingMode === 'scouting' ? { buyCost: BUY_COST, targetProfit } : {}),
      amazonFees,
      ourCosts,
      profitPool,
      totalDeductions,
    },
    profitAnalysis: {
      ourProfit,
      roi,
      roiFloor,
      profitMargin,
      buySignal,
      meetsTargetProfit,
      meetsROI,
      targetProfitCents: targetProfit,
    },
  };

  if (offer <= 0) {
    return { ...meta, status: 'rejected', reason: 'price_too_low', message: "Sorry, the resale value is too low for us to make an offer on this item", offerCents: 0, offerDisplay: '$0.00', _debug };
  }

  let status, color, label;
  if (offer >= 150) {
    status = 'accepted'; color = 'green'; label = "We'll Buy This!";
  } else {
    status = 'low'; color = 'yellow'; label = "Low Offer";
  }

  return {
    ...meta,
    status,
    color,
    label,
    offerCents: Math.round(offer),
    offerDisplay: cents(Math.round(offer)),
    _debug,
  };
}

module.exports = {
  calculateOffer, detectCategory, getSellPrice, getSellPriceSource,
  getSlotPrice, getUsedSlotPrice, getAllConditionPrices, getWeightLbs, getSalesRank,
  getTargetProfit, getTrigger, getFbaFee, getKeepaFbaFee, getMediaMailCost,
  getVelocity, getAverageUsedPrice, getFbaUsedAvgPrice, TRIGGERS,
};

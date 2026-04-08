import { useState } from 'react';
import {
  Search, Loader2, DollarSign, TrendingUp, Package, Scale,
  ArrowDown, CheckCircle, XCircle, AlertTriangle, Zap, Clock,
  Activity, Database, ChevronDown, ChevronUp, Archive, ClipboardCheck,
} from 'lucide-react';
import { useAdminReview } from '../hooks/useAdminReview';

function cents(v) {
  if (v == null) return '—';
  return `$${(v / 100).toFixed(2)}`;
}

function StatusBadge({ status, color }) {
  const styles = {
    green: 'bg-accept-light text-accept border-accept/20',
    yellow: 'bg-warning-light text-warning border-warning/20',
    red: 'bg-reject-light text-reject border-reject/20',
  };
  const icons = { green: CheckCircle, yellow: AlertTriangle, red: XCircle };
  const Icon = icons[color] || XCircle;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${styles[color] || styles.red}`}>
      <Icon size={14} />
      {status}
    </span>
  );
}

function VelocityBadge({ tier, label }) {
  const styles = {
    fast: 'bg-accept-light text-accept',
    medium: 'bg-brand-100 text-brand-700',
    slow: 'bg-warning-light text-warning',
    very_slow: 'bg-reject-light text-reject',
  };
  const icons = { fast: Zap, medium: Activity, slow: Clock, very_slow: Clock };
  const Icon = icons[tier] || Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${styles[tier] || ''}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}

function PriceRow({ label, value, selected, tag }) {
  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-md ${selected ? 'bg-brand-100 border border-brand-500/30' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">{label}</span>
        {selected && <span className="text-xs font-bold text-brand-700 bg-brand-200 px-1.5 py-0.5 rounded">SELECTED</span>}
        {tag && <span className="text-xs text-text-muted">{tag}</span>}
      </div>
      <span className={`text-sm font-mono font-semibold ${value ? 'text-text-primary' : 'text-text-muted'}`}>
        {value ? cents(value) : '—'}
      </span>
    </div>
  );
}

function FeeRow({ label, amount, icon: Icon }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        {Icon && <Icon size={14} className="text-text-muted" />}
        {label}
      </div>
      <span className="text-sm font-mono text-reject">-{cents(amount)}</span>
    </div>
  );
}

export default function AdminPage() {
  const [query, setQuery] = useState('');
  const { loading, data, error, fetchReview } = useAdminReview();
  const [rawOpen, setRawOpen] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    fetchReview(q);
  }

  const p = data?.product;
  const scout = data?.scouting;
  const buyback = data?.buyback;
  const v = data?.velocity;
  // Default view: scouting (your profit analysis)
  const pr = scout;
  const o = scout?.offer;
  const src = pr?.priceSource;
  const fees = pr?.fees;
  // Buyback (customer offer)
  const bo = buyback?.offer;

  return (
    <div className="max-w-4xl mx-auto px-[var(--spacing-page)] py-6">
      {/* Admin nav */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-text-primary font-semibold flex items-center gap-1">
          <Database size={14} /> Product Review
        </span>
        <span className="text-text-muted">/</span>
        <a href="/admin/orders" className="text-text-muted hover:text-brand-700 flex items-center gap-1">
          <Package size={14} /> Orders
        </a>
        <span className="text-text-muted">/</span>
        <a href="/admin/inventory" className="text-text-muted hover:text-brand-700 flex items-center gap-1">
          <Archive size={14} /> Inventory
        </a>
        <span className="text-text-muted">/</span>
        <a href="/admin/quotes" className="text-text-muted hover:text-brand-700 flex items-center gap-1">
          <ClipboardCheck size={14} /> Quotes
        </a>
      </div>

      <h1 className="font-display font-bold text-2xl text-text-primary mb-6">
        CleanSlate Admin Review
      </h1>

      {/* Search */}
      <form onSubmit={handleSubmit} className="relative mb-8">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter ISBN, UPC, or ASIN..."
          className="w-full pl-12 pr-32 py-3.5 rounded-[var(--radius-lg)] border border-border bg-surface text-text-primary placeholder:text-text-muted text-base focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[48px]"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-brand-600 hover:bg-brand-700 disabled:bg-text-muted text-white font-semibold text-sm px-5 py-2 rounded-[var(--radius-md)] transition-colors min-h-[40px]"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Review'}
        </button>
      </form>

      {error && (
        <div className="bg-reject-light border border-reject/20 rounded-[var(--radius-lg)] p-4 mb-6 text-sm text-reject">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 size={32} className="text-brand-500 animate-spin" />
          <p className="text-sm text-text-muted">Analyzing item...</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {/* Product Header + Status */}
          <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
            <div className="flex gap-4">
              {p?.imageUrl && (
                <img src={p.imageUrl} alt="" className="w-24 h-24 rounded-[var(--radius-md)] object-cover bg-background flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-bold text-lg text-text-primary leading-snug">{p?.title}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {p?.asin && (
                    <a href={`https://www.amazon.com/dp/${p.asin}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-mono text-brand-600 hover:text-brand-800 bg-brand-50 px-2 py-0.5 rounded underline">
                      ASIN: {p.asin}
                    </a>
                  )}
                  {p?.asin && (
                    <a href={`https://www.amazon.com/gp/offer-listing/${p.asin}?condition=used`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand-600 hover:text-brand-800 bg-brand-50 px-2 py-0.5 rounded underline">
                      All Used Offers
                    </a>
                  )}
                  {p?.category && <span className="text-xs font-semibold text-brand-700 bg-brand-100 px-2 py-0.5 rounded capitalize">{p.category}</span>}
                  {p?.weightLbs && <span className="text-xs text-text-muted flex items-center gap-1"><Scale size={12} />{p.weightLbs} lbs</span>}
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-3">
                  <div>
                    <p className="text-xs text-text-muted mb-0.5">Your Profit (Scouting)</p>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-3xl text-text-primary">{o?.offerDisplay}</span>
                      <StatusBadge status={o?.label || o?.reason || o?.status} color={o?.color || 'red'} />
                    </div>
                  </div>
                  {bo && (
                    <div className="border-l border-border pl-4">
                      <p className="text-xs text-text-muted mb-0.5">Customer Offer (Buyback)</p>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-2xl text-brand-700">{bo.offerDisplay}</span>
                        <StatusBadge status={bo.label || bo.reason || bo.status} color={bo.color || 'red'} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Keepa Chart */}
          {p?.asin && (
            <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4 overflow-hidden">
              <h3 className="font-display font-semibold text-base text-text-primary mb-3 flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-600" />
                Keepa Price & Rank History
              </h3>
              <img
                src={`https://graph.keepa.com/pricehistory.png?asin=${p.asin}&domain=com&salesrank=1&used=1&bb=1&fba=1&range=180&width=800&height=350`}
                alt="Keepa price history chart"
                className="w-full rounded-[var(--radius-md)]"
              />
              <div className="flex gap-3 mt-2 text-xs text-text-muted">
                <a href={`https://keepa.com/#!product/1-${p.asin}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">View on Keepa</a>
                <a href={`https://www.amazon.com/dp/${p.asin}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">Amazon Listing</a>
                <a href={`https://www.amazon.com/gp/offer-listing/${p.asin}?condition=used`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">All Offers</a>
              </div>
            </div>
          )}

          {/* Offer Explanation */}
          {buyback?.sellPrice > 0 && (
            <div className="bg-brand-50 rounded-[var(--radius-lg)] border border-brand-200 p-4">
              <p className="text-sm text-text-primary leading-relaxed">
                <span className="font-semibold">How we calculated this offer:</span>{' '}
                Sell price {cents(buyback?.sellPrice)} (90-day Buy Box Used avg)
                minus Amazon fees {cents(buyback?.fees?.amazonFees)} and our costs {cents(buyback?.fees?.ourCosts)}
                leaves a profit pool of {cents(buyback?.fees?.profitPool)}.
                At a {buyback?.profitAnalysis?.roiFloor}% ROI floor, your offer is{' '}
                <span className="font-bold text-brand-700">{bo?.offerDisplay}</span>{' '}
                and we keep {cents(buyback?.profitAnalysis?.ourProfit)} ({buyback?.profitAnalysis?.roi}% ROI).
                {v?.monthlySales > 0 && ` This item sells ~${v.monthlySales}x/month (${v.velocityLabel.toLowerCase()}).`}
              </p>
            </div>
          )}

          {/* Two-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sell Price Analysis */}
            <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
              <h3 className="font-display font-semibold text-base text-text-primary mb-4 flex items-center gap-2">
                <DollarSign size={18} className="text-brand-600" />
                Sell Price Analysis
              </h3>
              <div className="space-y-1">
                <PriceRow label="FBA Slot 1" value={src?.candidates?.fbaSlotPrice} selected={src?.selected?.startsWith('fbaSlot')} tag={`${src?.fbaOffersCount || 0} FBA offers`} />
                <PriceRow label="Used Slot 3" value={src?.candidates?.usedSlotPrice} selected={src?.selected?.startsWith('usedSlot')} tag={`${src?.usedOffersCount || 0} used offers`} />
                <PriceRow label="Used Buy Box" value={src?.candidates?.usedBuyBox} selected={src?.selected?.includes('usedBuyBox')} tag="csv[17]" />
                <PriceRow label="Average Used" value={src?.candidates?.averageUsed} selected={src?.selected === 'averageUsed'} tag="fallback" />
                <PriceRow label="Lowest Used" value={src?.candidates?.lowestUsed} selected={src?.selected === 'lowestUsed'} tag="csv[2]" />
                <PriceRow label="Used Very Good" value={src?.candidates?.usedVeryGood} tag="csv[10]" />
                <PriceRow label="Used Good" value={src?.candidates?.usedGood} tag="csv[11]" />
                <PriceRow label="New 3P" value={src?.candidates?.new3p} selected={src?.selected === 'new3p_estimated'} tag="csv[1]" />
                <PriceRow label="New Cap (95%)" value={src?.candidates?.newCap} tag={`${src?.trigger?.offNewBB * 100}% off`} />
                <PriceRow label="Amazon" value={src?.candidates?.amazon} tag="csv[0]" />
                <PriceRow label="Amazon Cap" value={src?.candidates?.amazonCap} tag={`${src?.trigger?.offAmazon * 100}% off`} />
              </div>
              <div className="mt-3 pt-3 border-t border-border text-xs text-text-muted">
                {src?.offersCount} total offers | {src?.usedOffersCount} used | {src?.fbaOffersCount} FBA
              </div>
            </div>

            {/* Fee Waterfall */}
            <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
              <h3 className="font-display font-semibold text-base text-text-primary mb-4 flex items-center gap-2">
                <ArrowDown size={18} className="text-brand-600" />
                Fee Waterfall
              </h3>
              {fees ? (
                <>
                  <div className="flex items-center justify-between py-2 mb-2 border-b border-border">
                    <span className="text-sm font-semibold text-text-primary">Sell Price</span>
                    <span className="text-sm font-mono font-bold text-accept">{cents(pr?.sellPrice)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <FeeRow label="Referral Fee (15%)" amount={fees.referralFee} />
                    <FeeRow label="Closing Fee" amount={fees.closingFee} />
                    <FeeRow label="FBA Fulfillment" amount={fees.fbaFee} />
                  </div>
                  <div className="flex items-center justify-between py-1.5 mt-1 border-t border-border">
                    <span className="text-xs font-semibold text-text-muted">Amazon Fees</span>
                    <span className="text-xs font-mono text-reject">-{cents(fees.amazonFees)}</span>
                  </div>
                  <div className="space-y-0.5 mt-2">
                    <FeeRow label="Prep Fee" amount={fees.prepFee} />
                    <FeeRow label="Inbound FBA Ship" amount={fees.inboundShip} />
                    <FeeRow label="Media Mail to Us" amount={fees.customerShip} />
                    {fees.discBuffer > 0 && <FeeRow label="Disc Buffer" amount={fees.discBuffer} />}
                    {fees.buyCost > 0 && <FeeRow label="Buy Cost" amount={fees.buyCost} />}
                    {fees.targetProfit > 0 && <FeeRow label="Target Profit" amount={fees.targetProfit} />}
                  </div>
                  <div className="flex items-center justify-between py-1.5 mt-1 border-t border-border">
                    <span className="text-xs font-semibold text-text-muted">Our Costs</span>
                    <span className="text-xs font-mono text-reject">-{cents(fees.ourCosts)}</span>
                  </div>
                  {fees.profitPool > 0 && (
                    <div className="flex items-center justify-between py-2 mt-2 border-t-2 border-border">
                      <span className="text-sm font-semibold text-text-primary">Profit Pool</span>
                      <span className="text-sm font-mono font-bold text-text-primary">{cents(fees.profitPool)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-3 mt-1 bg-brand-50 rounded-[var(--radius-md)] px-3">
                    <span className="font-display font-bold text-text-primary">
                      {pr === scout ? 'Scouting Offer' : 'Customer Offer'}
                    </span>
                    <span className="font-display font-bold text-xl text-brand-700">{o?.offerDisplay}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-text-muted">No fee data available (item rejected before calculation)</p>
              )}
            </div>
          </div>

          {/* Velocity Panel */}
          {v && (
            <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
              <h3 className="font-display font-semibold text-base text-text-primary mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-600" />
                Velocity & Demand
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-text-muted mb-1">Monthly Sales</p>
                  <p className="font-display font-bold text-2xl text-text-primary">{v.monthlySales ?? '—'}</p>
                  <p className="text-xs text-text-muted">{v.source === 'keepa_monthly_sold' ? 'Keepa data' : v.source}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Velocity</p>
                  <VelocityBadge tier={v.velocityTier} label={v.velocityLabel} />
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Sales Rank</p>
                  <p className="font-display font-bold text-lg text-text-primary">#{v.salesRank?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Rank Avg 90d</p>
                  <p className="font-display font-bold text-lg text-text-primary">{v.rankAvg90 ? '#' + v.rankAvg90.toLocaleString() : '—'}</p>
                </div>
              </div>
              {/* Rank drops */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                <div className="text-center">
                  <p className="font-display font-bold text-xl text-text-primary">{v.rankDrops30 ?? '—'}</p>
                  <p className="text-xs text-text-muted">Drops 30d</p>
                </div>
                <div className="text-center">
                  <p className="font-display font-bold text-xl text-text-primary">{v.rankDrops90 ?? '—'}</p>
                  <p className="text-xs text-text-muted">Drops 90d</p>
                </div>
                <div className="text-center">
                  <p className="font-display font-bold text-xl text-text-primary">{v.rankDrops180 ?? '—'}</p>
                  <p className="text-xs text-text-muted">Drops 180d</p>
                </div>
              </div>
            </div>
          )}

          {/* Profit Analysis / Buy-Pass Signal */}
          {scout?.profitAnalysis && (
            <div className={`rounded-[var(--radius-lg)] border p-5 ${scout.profitAnalysis.buySignal === 'BUY' ? 'bg-accept-light border-accept/30' : 'bg-reject-light border-reject/30'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-base text-text-primary flex items-center gap-2">
                    {scout.profitAnalysis.buySignal === 'BUY' ? <CheckCircle size={20} className="text-accept" /> : <XCircle size={20} className="text-reject" />}
                    Scouting Verdict: {scout.profitAnalysis.buySignal}
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    Net profit: {cents(scout.profitAnalysis.netProfit)} | ROI: {scout.profitAnalysis.roi}% | Margin: {scout.profitAnalysis.profitMargin}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted">Target: {cents(scout.profitAnalysis.targetProfitCents)} profit + {scout.profitAnalysis.roiFloor}% ROI floor</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${scout.profitAnalysis.meetsTargetProfit ? 'bg-accept/20 text-accept' : 'bg-reject/20 text-reject'}`}>
                      Profit {scout.profitAnalysis.meetsTargetProfit ? 'OK' : 'LOW'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${scout.profitAnalysis.meetsROI ? 'bg-accept/20 text-accept' : 'bg-reject/20 text-reject'}`}>
                      ROI {scout.profitAnalysis.roi}% {scout.profitAnalysis.meetsROI ? 'OK' : `< ${scout.profitAnalysis.roiFloor}%`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Competition / Offers on Listing */}
          {data.competition && (
            <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
              <h3 className="font-display font-semibold text-base text-text-primary mb-4 flex items-center gap-2">
                <Activity size={18} className="text-brand-600" />
                Offers on Listing
              </h3>
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">{data.competition.summary.totalActive} Total</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accept-light text-accept">{data.competition.summary.usedFBA} Used FBA</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background text-text-secondary">{data.competition.summary.usedFBM} Used FBM</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background text-text-secondary">{data.competition.summary.newFBA} New FBA</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background text-text-secondary">{data.competition.summary.newFBM} New FBM</span>
                {data.competition.buyBoxIsAmazon && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-warning-light text-warning">Amazon on listing</span>}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Used FBA Offers */}
                <div>
                  <p className="text-xs font-semibold text-accept mb-2">Used FBA Offers</p>
                  <div className="space-y-1">
                    {data.competition.usedFBA.map((o, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm bg-accept-light/50">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-text-primary">{cents(o.total)}</span>
                          <span className="text-xs text-text-muted">{o.condition}</span>
                        </div>
                        {o.sellerId ? (
                          <a href={`https://www.amazon.com/sp?seller=${o.sellerId}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:underline font-mono">{o.sellerId.substring(0, 10)}</a>
                        ) : <span className="text-xs text-text-muted">—</span>}
                      </div>
                    ))}
                    {data.competition.usedFBA.length === 0 && <p className="text-xs text-text-muted">No FBA used offers</p>}
                  </div>
                </div>
                {/* Used FBM Offers */}
                <div>
                  <p className="text-xs font-semibold text-text-secondary mb-2">Used FBM Offers</p>
                  <div className="space-y-1">
                    {data.competition.usedFBM.map((o, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-text-primary">{cents(o.price)}</span>
                          {o.shipping > 0 && <span className="text-xs text-text-muted">+{cents(o.shipping)} ship</span>}
                          <span className="text-xs text-text-muted">{o.condition}</span>
                        </div>
                        {o.sellerId ? (
                          <a href={`https://www.amazon.com/sp?seller=${o.sellerId}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:underline font-mono">{o.sellerId.substring(0, 10)}</a>
                        ) : <span className="text-xs text-text-muted">—</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cache & Tokens */}
          <div className="flex items-center gap-4 text-xs text-text-muted">
            {data.cache && <span>Cache: {data.cache.size} items, {(data.cache.hitRate * 100).toFixed(0)}% hit rate</span>}
            {data.keepaTokensLeft != null && <span>Keepa tokens: {data.keepaTokensLeft}</span>}
          </div>

          {/* Raw Data (collapsible) */}
          <details className="bg-surface rounded-[var(--radius-lg)] border border-border">
            <summary className="p-4 cursor-pointer text-sm font-semibold text-text-secondary hover:text-text-primary flex items-center gap-2">
              <Package size={16} />
              Raw API Response
            </summary>
            <pre className="p-4 pt-0 text-xs text-text-muted overflow-x-auto whitespace-pre-wrap font-mono">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

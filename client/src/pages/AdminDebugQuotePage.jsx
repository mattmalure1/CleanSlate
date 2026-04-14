import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Loader2, CheckCircle2, XCircle, AlertCircle,
  ChevronDown, ChevronUp, RefreshCw, Database, Clock,
  TrendingUp, DollarSign, Package, ArrowLeft,
} from 'lucide-react';
import { useDebugQuote } from '../hooks/useDebugQuote';

// ---- formatting helpers ----
function cents(v) {
  if (v == null) return '—';
  return `$${(v / 100).toFixed(2)}`;
}

function pct(v, digits = 1) {
  if (v == null) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

function num(v) {
  if (v == null) return '—';
  return v.toLocaleString();
}

function human(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return v.length === 0 ? '[]' : v.join(' › ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ---- 11-step metadata ----
const STEPS = [
  { n: 1,  name: 'UPC → ASIN resolution',         blurb: 'Keepa lookup returns a product' },
  { n: 2,  name: 'Data freshness',                blurb: 'Keepa data is no older than 30 days' },
  { n: 3,  name: 'Hard rejection filters',        blurb: 'hazmat / adult / oversize / blacklist / cooldown / inventory cap' },
  { n: 4,  name: 'Category + velocity + tier',    blurb: 'Category detected, rank drops ≥ 4, tier assigned' },
  { n: 5,  name: 'Price determination',           blurb: 'MIN(current, 90d avg) used-buybox, volatility < 30%' },
  { n: 6,  name: 'Competition check',             blurb: 'FBA offer count gate (Amazon-on-listing no longer penalizes)' },
  { n: 7,  name: 'Fee calculation',               blurb: 'Referral, closing, FBA, prep, shipping, storage, buffers' },
  { n: 8,  name: 'Net resale value',              blurb: 'working_price − total_fees' },
  { n: 9,  name: 'Inventory throttling',          blurb: 'Currently MVP: always 1.0' },
  { n: 10, name: 'ROI floor + final offer',       blurb: 'Tier ROI floor, min flat margin, round down to $0.05' },
  { n: 11, name: 'Sanity checks',                 blurb: 'offer ≥ $0.25, offer ≤ 50% of working price' },
];

// ---- UI primitives ----
function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-border rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
      <div>
        <h2 className="font-semibold text-text-primary">{title}</h2>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function KV({ label, value, mono = false, flag = null }) {
  const color =
    flag === 'null' ? 'bg-yellow-50 border-yellow-300' :
    flag === 'stale' ? 'bg-red-50 border-red-300' :
    '';
  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-1.5 rounded border ${color || 'border-transparent'}`}>
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`text-sm text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function Pill({ children, color = 'gray' }) {
  const styles = {
    gray:   'bg-gray-100 text-gray-700 border-gray-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[color]}`}>
      {children}
    </span>
  );
}

// ---- Final result banner ----
function ResultBanner({ result, trace }) {
  if (!result) return null;
  if (result.accepted) {
    return (
      <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-green-600" size={32} />
          <div>
            <div className="text-sm font-medium text-green-700 uppercase tracking-wide">Accepted</div>
            <div className="text-3xl font-bold text-green-800">{cents(result.offer_cents)}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-sm text-text-muted">Tier</div>
            <div className="text-2xl font-bold text-green-800">{result.tier}</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="p-6 bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-300 rounded-xl">
      <div className="flex items-center gap-3">
        <XCircle className="text-red-600" size={32} />
        <div className="flex-1">
          <div className="text-sm font-medium text-red-700 uppercase tracking-wide">
            Rejected at Step {result.rejection_step}
          </div>
          <div className="text-xl font-bold text-red-800">{result.rejection_reason}</div>
          {trace?.rejection_reason_detail && (
            <div className="text-xs text-red-600 font-mono mt-1">
              detail: {trace.rejection_reason_detail}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Extracted fields panel ----
function ExtractedFieldsPanel({ fields }) {
  if (!fields) return null;

  const groups = [
    {
      label: 'Identity',
      items: [
        ['asin', fields.asin],
        ['title', fields.title],
        ['category_tree', fields.category_tree],
        ['category_root', fields.category_root],
      ],
    },
    {
      label: 'Pricing (used-buybox anchor, Keepa index 32)',
      items: [
        ['current_used_buybox_cents', cents(fields.current_used_buybox_cents)],
        ['current_amazon_cents', cents(fields.current_amazon_cents)],
        ['current_new_3p_cents', cents(fields.current_new_3p_cents)],
        ['avg_90_day_used_buybox_cents', cents(fields.avg_90_day_used_buybox_cents)],
        ['avg_180_day_used_buybox_cents', cents(fields.avg_180_day_used_buybox_cents)],
        ['min_90_day_used_cents', cents(fields.min_90_day_used_cents)],
        ['max_90_day_used_cents', cents(fields.max_90_day_used_cents)],
      ],
    },
    {
      label: 'Velocity / rank',
      items: [
        ['sales_rank_drops_30', num(fields.sales_rank_drops_30)],
        ['sales_rank_drops_90', num(fields.sales_rank_drops_90)],
        ['sales_rank_drops_180', num(fields.sales_rank_drops_180)],
        ['current_bsr', num(fields.current_bsr)],
        ['avg_90_day_bsr', num(fields.avg_90_day_bsr)],
      ],
    },
    {
      label: 'Competition',
      items: [
        ['new_offer_count', num(fields.new_offer_count)],
        ['fba_offer_count', num(fields.fba_offer_count)],
        ['amazon_is_seller', String(fields.amazon_is_seller)],
      ],
    },
    {
      label: 'Package',
      items: [
        ['package_length_mm', num(fields.package_length_mm)],
        ['package_width_mm', num(fields.package_width_mm)],
        ['package_height_mm', num(fields.package_height_mm)],
        ['package_weight_g', num(fields.package_weight_g)],
      ],
    },
    {
      label: 'Flags',
      items: [
        ['is_hazmat', String(fields.is_hazmat)],
        ['is_adult', String(fields.is_adult)],
        ['is_redirect', String(fields.is_redirect)],
      ],
    },
  ];

  const ageFlag = fields.data_age_days > 20 ? 'stale' : null;

  return (
    <div>
      <div className="px-5 py-3 bg-slate-50 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database size={16} className="text-text-muted" />
          <span className="text-sm font-medium">Keepa data age:</span>
          <span className={`font-mono text-sm ${fields.data_age_days > 20 ? 'text-red-600 font-bold' : 'text-text-primary'}`}>
            {fields.data_age_days} day{fields.data_age_days === 1 ? '' : 's'}
          </span>
        </div>
        {ageFlag === 'stale' && (
          <Pill color="red">stale (&gt; 20 days)</Pill>
        )}
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{g.label}</div>
            <div className="space-y-0.5">
              {g.items.map(([k, v]) => {
                const isNull =
                  v === null || v === undefined || v === '—' || v === 'null' || v === '[]';
                return <KV key={k} label={k} value={human(v)} mono flag={isNull ? 'null' : null} />;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Step status helper ----
function stepStatus(stepN, result, trace) {
  // Accepted with null rejection_step: every step passed
  if (!result) return 'pending';
  const rej = trace?.rejection_step ?? null;
  if (rej === null && result.accepted) return 'passed';
  if (rej === null && !result.accepted) return 'pending'; // shouldn't happen
  if (stepN < rej) return 'passed';
  if (stepN === rej) return 'rejected';
  return 'skipped';
}

// ---- Per-step derived payload (inputs / decision / outputs) ----
function stepPayload(stepN, trace, fields, result) {
  if (!trace) return null;
  const penny = (v) => cents(v);
  const hr = trace.hard_rejections_checked || [];

  switch (stepN) {
    case 1:
      return {
        inputs: [['asin', trace.asin ?? '(none)']],
        decision: trace.asin ? `Resolved ASIN ${trace.asin}` : 'No ASIN returned',
      };
    case 2:
      return {
        inputs: [['data_age_days', fields?.data_age_days ?? '—']],
        decision: fields?.data_age_days > 30 ? 'FAIL: data > 30 days old' : 'PASS: data fresh enough',
      };
    case 3:
      return {
        inputs: [['checks_run', hr]],
        decision:
          trace.rejection_step === 3
            ? `REJECTED at check: ${hr[hr.length - 1] || '(unknown)'}`
            : `PASS: ${hr.length} check${hr.length === 1 ? '' : 's'} cleared`,
      };
    case 4:
      return {
        inputs: [
          ['category_tree', fields?.category_tree],
          ['detected_category', trace.category],
          ['sales_rank_drops_90', fields?.sales_rank_drops_90],
          ['current_bsr', fields?.current_bsr],
        ],
        decision: trace.tier_assigned
          ? `Assigned tier ${trace.tier_assigned}`
          : trace.rejection_step === 4
          ? `REJECTED: ${trace.rejection_reason_detail || '(see banner)'}`
          : '(not reached)',
      };
    case 5:
      return {
        inputs: [
          ['current_used_buybox_cents', penny(fields?.current_used_buybox_cents)],
          ['avg_90_day_used_buybox_cents', penny(fields?.avg_90_day_used_buybox_cents)],
        ],
        decision: trace.working_price_cents != null
          ? `working_price = ${penny(trace.working_price_cents)} (source: ${trace.working_price_source}), volatility = ${pct(trace.volatility_ratio)}`
          : trace.rejection_step === 5
          ? `REJECTED at price determination`
          : '(not reached)',
      };
    case 6:
      return {
        inputs: [
          ['fba_offer_count', fields?.fba_offer_count],
          ['amazon_is_seller (informational only)', String(fields?.amazon_is_seller)],
          ['working_price', penny(trace.working_price_cents)],
        ],
        decision:
          trace.rejection_step === 6
            ? `REJECTED: too competitive for working price`
            : `competition_penalty = ${trace.competition_penalty_applied}`,
      };
    case 7: {
      const f = trace.fees_breakdown;
      if (!f) return { inputs: [], decision: '(not reached)' };
      return {
        inputs: [
          ['referral_fee_cents (15%)', penny(f.referral_fee_cents)],
          ['closing_fee_cents', penny(f.closing_fee_cents)],
          ['fba_fulfillment_fee_cents', penny(f.fba_fulfillment_fee_cents)],
          ['prep_cost_cents', penny(f.prep_cost_cents)],
          ['inbound_shipping_cents', penny(f.inbound_shipping_cents)],
          ['media_mail_receive_cents', penny(f.media_mail_receive_cents)],
          ['disc_buffer_cents', penny(f.disc_buffer_cents)],
          ['rejection_return_overhead_cents', penny(f.rejection_return_overhead_cents)],
          ['storage_reserve_cents', penny(f.storage_reserve_cents)],
        ],
        decision: `total_fees = ${penny(f.total_fees_cents)}`,
      };
    }
    case 8:
      return {
        inputs: [
          ['working_price', penny(trace.working_price_cents)],
          ['total_fees', penny(trace.fees_breakdown?.total_fees_cents)],
        ],
        decision: trace.net_resale_cents != null
          ? `net_resale = ${penny(trace.net_resale_cents)}`
          : trace.rejection_step === 8
          ? 'REJECTED: no margin after fees'
          : '(not reached)',
      };
    case 9:
      return {
        inputs: [['inventory_count', '(MVP: always 0)']],
        decision: `inventory_penalty = ${trace.inventory_penalty_applied}`,
      };
    case 10:
      return {
        inputs: [
          ['net_resale', penny(trace.net_resale_cents)],
          ['roi_floor_applied', `${trace.roi_floor_applied ?? '—'}%`],
          ['required_margin', penny(trace.required_margin_cents)],
          ['competition_penalty', trace.competition_penalty_applied],
          ['inventory_penalty', trace.inventory_penalty_applied],
        ],
        decision: trace.final_offer_cents != null
          ? `final_offer = ${penny(trace.final_offer_cents)}`
          : '(not reached)',
      };
    case 11:
      return {
        inputs: [['final_offer_cents', penny(trace.final_offer_cents)]],
        decision:
          trace.rejection_step === 11
            ? `REJECTED: ${trace.rejection_reason_detail || '(sanity check)'}`
            : result?.accepted
            ? 'PASS: accepted'
            : '(not reached)',
      };
    default:
      return null;
  }
}

function StepCard({ step, status, payload }) {
  const [open, setOpen] = useState(status === 'rejected');

  const border =
    status === 'rejected' ? 'border-red-400 bg-red-50'
    : status === 'passed' ? 'border-green-200 bg-green-50/30'
    : status === 'skipped' ? 'border-gray-200 bg-gray-50 opacity-60'
    : 'border-border';

  const icon =
    status === 'rejected' ? <XCircle size={18} className="text-red-600" />
    : status === 'passed' ? <CheckCircle2 size={18} className="text-green-600" />
    : status === 'skipped' ? <div className="w-[18px] h-[18px] rounded-full bg-gray-300" />
    : <AlertCircle size={18} className="text-text-muted" />;

  return (
    <div className={`border rounded-lg ${border}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/50"
      >
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-muted">STEP {step.n}</span>
            <span className="font-medium text-text-primary">{step.name}</span>
          </div>
          <div className="text-xs text-text-muted mt-0.5">{step.blurb}</div>
        </div>
        {open ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
      </button>
      {open && payload && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 bg-white/60 space-y-3">
          {payload.inputs.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-text-muted uppercase mb-1">Inputs</div>
              <div className="space-y-0.5">
                {payload.inputs.map(([k, v]) => (
                  <div key={k} className="flex justify-between font-mono text-xs">
                    <span className="text-text-muted">{k}</span>
                    <span className="text-text-primary">{human(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-text-muted uppercase mb-1">Decision</div>
            <div className="text-sm text-text-primary">{payload.decision}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Fees breakdown table ----
function FeesBreakdown({ trace }) {
  const f = trace?.fees_breakdown;
  if (!f) {
    return (
      <div className="p-5 text-sm text-text-muted italic">
        Fees not computed — engine rejected before Step 7.
      </div>
    );
  }
  const rows = [
    ['Referral fee (15%)', f.referral_fee_cents, 'calculated: working_price × referral_fee_rate'],
    ['Closing fee', f.closing_fee_cents, 'config: closing_fee_cents'],
    ['FBA fulfillment fee', f.fba_fulfillment_fee_cents, 'calculated: lookupFBAFee(weight, dims)'],
    ['Prep cost', f.prep_cost_cents, 'config: prep_cost_cents'],
    ['Inbound shipping', f.inbound_shipping_cents, 'calculated: max($0.25, weight_lbs × inbound_per_lb)'],
    ['Media mail receive', f.media_mail_receive_cents, 'config: media_mail_receive_cents'],
    ['Disc buffer', f.disc_buffer_cents, trace.category && ['dvd','bluray','cd','game'].includes(trace.category) ? 'config: disc_buffer_cents (disc category)' : 'N/A (not a disc category)'],
    ['Rejection-return overhead', f.rejection_return_overhead_cents, 'config: rejection_return_overhead_cents'],
    ['Storage reserve', f.storage_reserve_cents, 'config: storage_reserve_cents'],
  ];
  return (
    <div className="p-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-text-muted uppercase border-b border-border">
            <th className="py-2 pr-2">Fee</th>
            <th className="py-2 px-2 text-right">Amount</th>
            <th className="py-2 pl-2 text-xs font-normal normal-case">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, v, src]) => (
            <tr key={label} className="border-b border-border/50">
              <td className="py-2 pr-2 text-text-primary">{label}</td>
              <td className="py-2 px-2 text-right font-mono text-red-600">-{cents(v)}</td>
              <td className="py-2 pl-2 text-xs text-text-muted">{src}</td>
            </tr>
          ))}
          <tr className="font-semibold bg-slate-50">
            <td className="py-2 pr-2">Total fees</td>
            <td className="py-2 px-2 text-right font-mono text-red-700 text-base">-{cents(f.total_fees_cents)}</td>
            <td className="py-2 pl-2"></td>
          </tr>
          <tr>
            <td className="py-2 pr-2 text-xs text-text-muted">working_price</td>
            <td className="py-2 px-2 text-right font-mono text-xs text-text-muted">{cents(trace.working_price_cents)}</td>
            <td></td>
          </tr>
          <tr>
            <td className="py-2 pr-2 font-semibold text-text-primary">Net resale</td>
            <td className="py-2 px-2 text-right font-mono font-semibold text-text-primary">{cents(trace.net_resale_cents)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---- Raw Keepa JSON viewer (collapsible) ----
function RawJsonViewer({ raw, cacheMeta, tokensLeft, elapsedMs }) {
  const [open, setOpen] = useState(false);
  if (!raw) return null;
  return (
    <div>
      <div className="px-5 py-3 bg-slate-50 border-b border-border flex items-center gap-3">
        <Database size={16} className="text-text-muted" />
        <span className="text-sm">Cache:</span>
        {cacheMeta?.hit ? (
          <Pill color="green">HIT · {Math.round((cacheMeta.ageMs || 0) / 60000)}m old</Pill>
        ) : cacheMeta?.forceRefresh ? (
          <Pill color="blue">FORCE REFRESH</Pill>
        ) : (
          <Pill color="yellow">MISS · fresh fetch</Pill>
        )}
        <span className="ml-auto flex items-center gap-3 text-xs text-text-muted">
          <span>{elapsedMs}ms total</span>
          {tokensLeft != null && <span>{tokensLeft} Keepa tokens left</span>}
        </span>
      </div>
      <div className="p-5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-sm text-brand-700 hover:text-brand-800"
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {open ? 'Hide' : 'Show'} raw Keepa response
        </button>
        {open && (
          <pre className="mt-3 p-3 bg-slate-900 text-slate-100 text-xs rounded-lg overflow-auto max-h-96 font-mono">
            {JSON.stringify(raw, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

// ---- Main page ----
export default function AdminDebugQuotePage() {
  const [code, setCode] = useState('');
  const [forceRefresh, setForceRefresh] = useState(false);
  const { loading, data, error, analyze } = useDebugQuote();

  function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    analyze(code.trim(), { forceRefresh });
  }

  const trace = data?.calculationTrace;
  const stepStatuses = useMemo(() => {
    if (!data) return {};
    const out = {};
    for (const s of STEPS) out[s.n] = stepStatus(s.n, data.result, trace);
    return out;
  }, [data, trace]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/admin" className="flex items-center gap-1 text-sm text-text-muted hover:text-brand-700">
          <ArrowLeft size={16} />
          Admin
        </Link>
        <span className="text-text-muted">/</span>
        <h1 className="text-xl font-semibold text-text-primary">Quote Debugger</h1>
        <Pill color="blue">spec §5</Pill>
      </div>

      <p className="text-sm text-text-muted mb-6 max-w-3xl">
        Paste a UPC or ASIN and see every step of the 11-step offer engine's calculation. Every weird quote
        becomes a 2-minute investigation instead of a mystery.
      </p>

      {/* Input */}
      <Card className="mb-6">
        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter UPC, ISBN, or ASIN"
                className="w-full pl-10 pr-3 py-3 text-sm border border-border rounded-lg focus:outline-none focus:border-brand-600 font-mono"
                aria-label="UPC, ISBN, or ASIN"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="px-6 py-3 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
          <label className="flex items-center gap-2 mt-3 text-sm text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              className="rounded border-border"
            />
            <RefreshCw size={14} />
            Force re-fetch from Keepa (bypass 24h cache)
          </label>
        </form>
      </Card>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Final result banner */}
          <ResultBanner result={data.result} trace={trace} />

          {/* Product header */}
          <Card>
            <div className="p-5 flex gap-4 items-start">
              {data.product.imageUrl && (
                <img
                  src={data.product.imageUrl}
                  alt=""
                  className="w-24 h-24 object-contain bg-slate-50 rounded-lg"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold text-text-primary">{data.product.title}</div>
                <div className="text-sm text-text-muted font-mono mt-1">ASIN: {data.product.asin}</div>
                <div className="text-sm text-text-muted font-mono">UPC: {data.code}</div>
                {trace?.category && (
                  <div className="mt-2">
                    <Pill color="blue">category: {trace.category}</Pill>
                    {data.gatedResult?.gated && (
                      <Pill color="red">gated: {data.gatedResult.reason}</Pill>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* 11-step algorithm trace */}
          <Card>
            <SectionHeader
              title="11-step algorithm trace"
              subtitle="Click any step to see its inputs and decision"
            />
            <div className="p-5 space-y-2">
              {STEPS.map((s) => (
                <StepCard
                  key={s.n}
                  step={s}
                  status={stepStatuses[s.n]}
                  payload={stepPayload(s.n, trace, data.extractedFields, data.result)}
                />
              ))}
            </div>
          </Card>

          {/* Extracted Keepa fields */}
          <Card>
            <SectionHeader
              title="Extracted Keepa fields"
              subtitle="Normalized from raw Keepa response. Yellow cells are null."
            />
            <ExtractedFieldsPanel fields={data.extractedFields} />
          </Card>

          {/* Fees breakdown */}
          <Card>
            <SectionHeader
              title="Fees breakdown"
              subtitle="Line-by-line with sources. Config values are read from offer_engine_config at startup."
            />
            <FeesBreakdown trace={trace} />
          </Card>

          {/* Tier + config snapshot */}
          {data.tiersForCategory && (
            <Card>
              <SectionHeader
                title="Tier thresholds (live snapshot)"
                subtitle={`For category: ${trace?.category || '—'}`}
              />
              <div className="p-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-text-muted uppercase border-b border-border">
                      <th className="py-2 pr-2">Tier</th>
                      <th className="py-2 px-2 text-right">Min drops/90d</th>
                      <th className="py-2 px-2 text-right">BSR ceiling</th>
                      <th className="py-2 px-2 text-right">ROI floor</th>
                      <th className="py-2 pl-2 text-right">Min margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tiersForCategory.map((t) => {
                      const isAssigned = t.tier === trace?.tier_assigned;
                      return (
                        <tr key={t.tier} className={`border-b border-border/50 ${isAssigned ? 'bg-brand-50 font-semibold' : ''}`}>
                          <td className="py-2 pr-2 font-mono">
                            {t.tier}
                            {isAssigned && <span className="ml-2 text-brand-700">← assigned</span>}
                          </td>
                          <td className="py-2 px-2 text-right font-mono">{t.min_rank_drops_90}</td>
                          <td className="py-2 px-2 text-right font-mono">{num(t.bsr_ceiling)}</td>
                          <td className="py-2 px-2 text-right font-mono">{t.roi_floor_percent}%</td>
                          <td className="py-2 pl-2 text-right font-mono">{cents(t.min_flat_margin_cents)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Raw Keepa viewer */}
          <Card>
            <SectionHeader title="Raw Keepa response" subtitle="Expand to inspect full JSON" />
            <RawJsonViewer
              raw={data.rawKeepa}
              cacheMeta={data.cacheMeta}
              tokensLeft={data.keepaTokensLeft}
              elapsedMs={data.elapsedMs}
            />
          </Card>

          {/* Deferred features note */}
          <div className="text-xs text-text-muted border border-dashed border-border rounded-lg p-4">
            <div className="font-semibold mb-1">Deferred for future sprints (spec §5.2 / §5.3):</div>
            <ul className="list-disc ml-5 space-y-0.5">
              <li>What-if sliders for tier ROI floors and margins</li>
              <li>"Run all 10 test cases" button</li>
              <li>Historical quote lookup by quote_item.id</li>
              <li>ScoutIQ side-by-side comparison</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

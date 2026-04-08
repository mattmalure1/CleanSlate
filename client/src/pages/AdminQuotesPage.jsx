import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Search, RefreshCw, Database, ClipboardCheck, Archive,
  BarChart3, DollarSign, Clock, Calendar, CheckCircle, Tag,
} from 'lucide-react';

function cents(v) { return v ? `$${(v / 100).toFixed(2)}` : '$0.00'; }

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function CategoryBadge({ category }) {
  if (!category) return null;
  return (
    <span className="text-xs font-semibold text-brand-700 bg-brand-100 px-2 py-0.5 rounded capitalize">
      {category}
    </span>
  );
}

function QuoteStatusBadge({ status }) {
  const styles = {
    quoted: 'bg-brand-100 text-brand-700',
    accepted: 'bg-accept-light text-accept',
    ordered: 'bg-accept-light text-accept',
  };
  const icons = {
    quoted: ClipboardCheck,
    accepted: CheckCircle,
    ordered: Package,
  };
  const Icon = icons[status] || ClipboardCheck;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.quoted}`}>
      <Icon size={12} />{status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Quoted'}
    </span>
  );
}

function OfferDot({ offerCents }) {
  if (!offerCents || offerCents <= 0) {
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-reject flex-shrink-0" />;
  }
  if (offerCents < 200) {
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-warning flex-shrink-0" />;
  }
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-accept flex-shrink-0" />;
}

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/quotes?${params}`);
      const data = await res.json();
      setQuotes(data.quotes || []);
      setStats(data.stats || {});
    } catch { setQuotes([]); }
    setLoading(false);
  }, [searchQuery, categoryFilter, statusFilter]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const conversionRate = stats.conversionRate != null
    ? `${(stats.conversionRate * 100).toFixed(1)}%`
    : '0.0%';

  return (
    <div className="max-w-5xl mx-auto px-[var(--spacing-page)] py-6">
      {/* Admin nav */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <Link to="/admin" className="text-text-muted hover:text-brand-700 flex items-center gap-1">
          <Database size={14} /> Product Review
        </Link>
        <span className="text-text-muted">/</span>
        <Link to="/admin/orders" className="text-text-muted hover:text-brand-700 flex items-center gap-1">
          <Package size={14} /> Orders
        </Link>
        <span className="text-text-muted">/</span>
        <Link to="/admin/inventory" className="text-text-muted hover:text-brand-700 flex items-center gap-1">
          <Archive size={14} /> Inventory
        </Link>
        <span className="text-text-muted">/</span>
        <span className="text-text-primary font-semibold flex items-center gap-1">
          <ClipboardCheck size={14} /> Quotes
        </span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Total Quotes</p>
          <p className="font-display font-bold text-2xl text-text-primary">{stats.total || 0}</p>
        </div>
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Conversion Rate</p>
          <p className="font-display font-bold text-2xl text-brand-700">{conversionRate}</p>
        </div>
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Average Offer</p>
          <p className="font-display font-bold text-2xl text-text-primary">{cents(stats.averageOfferCents)}</p>
        </div>
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Quotes Today</p>
          <p className="font-display font-bold text-2xl text-accept">{stats.quotesToday || 0}</p>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search barcode, ASIN, title..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[var(--radius-md)] border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500/30 min-h-[44px]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="text-sm px-3 py-2 rounded-[var(--radius-md)] border border-border bg-surface text-text-primary min-h-[44px]"
        >
          <option value="all">All Categories</option>
          <option value="books">Books</option>
          <option value="dvds">DVDs</option>
          <option value="cds">CDs</option>
          <option value="games">Games</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm px-3 py-2 rounded-[var(--radius-md)] border border-border bg-surface text-text-primary min-h-[44px]"
        >
          <option value="all">All Statuses</option>
          <option value="quoted">Quoted</option>
          <option value="accepted">Accepted</option>
          <option value="ordered">Ordered</option>
        </select>
        <button
          onClick={fetchQuotes}
          className="flex items-center gap-1.5 text-sm text-text-secondary px-3 py-2 rounded-[var(--radius-md)] border border-border hover:border-brand-400 transition-colors min-h-[44px]"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="text-brand-500 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && quotes.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <ClipboardCheck size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{searchQuery ? 'No quotes match your search' : 'No quotes yet'}</p>
        </div>
      )}

      {/* Quotes table */}
      {!loading && quotes.length > 0 && (
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-2.5 text-xs text-text-muted border-b border-border bg-background/50">
            <span className="w-16">Time</span>
            <span className="w-28">Barcode</span>
            <span className="flex-1">Title</span>
            <span className="w-20">Category</span>
            <span className="w-20">Condition</span>
            <span className="w-20 text-right">Offer</span>
            <span className="w-20 text-right">Status</span>
          </div>

          {/* Rows */}
          {quotes.map((quote, i) => (
            <div
              key={quote.id || i}
              className={`flex items-center gap-3 px-4 py-3 text-sm min-h-[44px] ${
                i < quotes.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <span className="w-16 text-xs text-text-muted flex items-center gap-1">
                <Clock size={12} />
                {quote.created_at ? timeAgo(quote.created_at) : '---'}
              </span>

              <span className="w-28 font-mono text-xs text-text-primary truncate">
                {quote.barcode || quote.isbn || '---'}
              </span>

              <span className="flex-1 text-text-primary truncate">
                {quote.title || 'Unknown'}
              </span>

              <span className="w-20">
                <CategoryBadge category={quote.category} />
              </span>

              <span className="w-20 text-xs text-text-secondary capitalize">
                {quote.condition || '---'}
              </span>

              <span className="w-20 text-right flex items-center justify-end gap-1.5">
                <OfferDot offerCents={quote.offer_cents} />
                <span className={`font-mono font-semibold ${quote.offer_cents > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                  {quote.offer_cents > 0 ? cents(quote.offer_cents) : 'No offer'}
                </span>
              </span>

              <span className="w-20 text-right">
                <QuoteStatusBadge status={quote.status} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

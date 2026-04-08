import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../api';
import {
  Package, Search, RefreshCw, Download, CheckSquare, Square,
  ChevronDown, ExternalLink, AlertTriangle, Timer, BarChart3,
  Clock, Truck, DollarSign, Database, ClipboardCheck, CheckCircle,
  XCircle, Archive, Tag, Calendar,
} from 'lucide-react';

const STATUSES = [
  { id: 'received', label: 'Received', color: 'bg-warning-light text-warning', icon: Package },
  { id: 'grading', label: 'Grading', color: 'bg-brand-200 text-brand-800', icon: ClipboardCheck },
  { id: 'graded', label: 'Graded', color: 'bg-brand-300 text-brand-800', icon: CheckCircle },
  { id: 'listed', label: 'Listed', color: 'bg-brand-100 text-brand-700', icon: Tag },
  { id: 'shipped_to_fba', label: 'Shipped to FBA', color: 'bg-brand-100 text-brand-700', icon: Truck },
  { id: 'active', label: 'Active', color: 'bg-accept-light text-accept', icon: BarChart3 },
  { id: 'sold', label: 'Sold', color: 'bg-accept-light text-accept', icon: DollarSign },
  { id: 'removed', label: 'Removed', color: 'bg-reject-light text-reject', icon: XCircle },
];

function cents(v) { return v ? `$${(v / 100).toFixed(2)}` : '$0.00'; }

function daysInInventory(receivedAt) {
  return Math.floor((Date.now() - new Date(receivedAt).getTime()) / 86400000);
}

function StatusBadge({ status }) {
  const s = STATUSES.find(st => st.id === status) || STATUSES[0];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.color}`}>
      <Icon size={12} />{s.label}
    </span>
  );
}

function DaysIndicator({ days }) {
  let colorClass = 'text-accept';
  if (days >= 90) colorClass = 'text-reject';
  else if (days >= 60) colorClass = 'text-warning';
  else if (days >= 30) colorClass = 'text-warning';

  return (
    <span className={`text-xs font-semibold ${colorClass} flex items-center gap-1`}>
      <Timer size={12} />{days}d
    </span>
  );
}

function CategoryBadge({ category }) {
  if (!category) return null;
  return (
    <span className="text-xs font-semibold text-brand-700 bg-brand-100 px-2 py-0.5 rounded capitalize">
      {category}
    </span>
  );
}

export default function AdminInventoryPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(apiUrl(`/api/admin/inventory?${params}`));
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats || {});
    } catch { setItems([]); }
    setLoading(false);
  }, [filter, categoryFilter, searchQuery]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function updateStatus(itemId, newStatus) {
    setUpdatingId(itemId);
    try {
      await fetch(apiUrl(`/api/admin/inventory/${itemId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchItems();
    } catch { /* ignore */ }
    setUpdatingId(null);
  }

  async function batchUpdate(newStatus) {
    if (selectedIds.size === 0) return;
    setUpdatingId('batch');
    try {
      await fetch(apiUrl('/api/admin/inventory/batch'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: [...selectedIds],
          status: newStatus,
        }),
      });
      setSelectedIds(new Set());
      fetchItems();
    } catch { /* ignore */ }
    setUpdatingId(null);
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  }

  // Aging alert
  const aging30 = stats.aging30 || 0;
  const aging60 = stats.aging60 || 0;
  const aging90 = stats.aging90 || 0;
  const maxAging = aging90 > 0 ? 90 : aging60 > 0 ? 60 : aging30 > 0 ? 30 : 0;
  const agingCount = aging90 || aging60 || aging30;

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
        <span className="text-text-primary font-semibold flex items-center gap-1">
          <Archive size={14} /> Inventory
        </span>
        <span className="text-text-muted">/</span>
        <Link to="/admin/quotes" className="text-text-muted hover:text-brand-700 flex items-center gap-1">
          <ClipboardCheck size={14} /> Quotes
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Total Items</p>
          <p className="font-display font-bold text-2xl text-text-primary">{stats.total || 0}</p>
        </div>
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Total Cost</p>
          <p className="font-display font-bold text-2xl text-brand-700">{cents(stats.totalCostCents)}</p>
        </div>
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Expected Profit</p>
          <p className="font-display font-bold text-2xl text-accept">{cents(stats.totalExpectedProfitCents)}</p>
        </div>
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Needing Attention</p>
          <p className="font-display font-bold text-2xl text-warning">{agingCount}</p>
        </div>
      </div>

      {/* Aging alert banner */}
      {maxAging >= 30 && (
        <div className={`rounded-[var(--radius-lg)] border p-3 mb-6 flex items-center gap-3 ${
          maxAging >= 90 ? 'bg-reject-light border-reject/20 text-reject' :
          maxAging >= 60 ? 'bg-warning-light border-warning/20 text-warning' :
          'bg-warning-light border-warning/20 text-warning'
        }`}>
          <AlertTriangle size={18} />
          <span className="text-sm font-semibold">
            {agingCount} item{agingCount !== 1 ? 's' : ''} {agingCount !== 1 ? 'have' : 'has'} been in inventory for {maxAging}+ days
          </span>
        </div>
      )}

      {/* Pipeline status pills */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mb-6">
        {['received', 'grading', 'graded', 'listed', 'shipped_to_fba', 'active', 'sold'].map(s => {
          const st = STATUSES.find(x => x.id === s);
          const count = stats[s] || 0;
          const isActive = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(isActive ? 'all' : s)}
              className={`flex flex-col items-center py-2 px-1 rounded-[var(--radius-md)] text-center transition-all min-h-[44px] ${
                isActive ? 'bg-brand-600 text-white' : 'bg-surface border border-border text-text-secondary hover:border-brand-400'
              }`}
            >
              <span className="font-display font-bold text-lg">{count}</span>
              <span className="text-[10px] leading-tight">{st?.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search + actions bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search SKU, ASIN, title..."
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
        <button
          onClick={fetchItems}
          className="flex items-center gap-1.5 text-sm text-text-secondary px-3 py-2 rounded-[var(--radius-md)] border border-border hover:border-brand-400 transition-colors min-h-[44px]"
        >
          <RefreshCw size={14} /> Refresh
        </button>
        <a
          href={apiUrl("/api/admin/inventory/export")}
          className="flex items-center gap-1.5 text-sm text-text-secondary px-3 py-2 rounded-[var(--radius-md)] border border-border hover:border-brand-400 transition-colors min-h-[44px]"
        >
          <Download size={14} /> Export CSV
        </a>
      </div>

      {/* Batch actions */}
      {selectedIds.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-[var(--radius-lg)] p-3 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-brand-700">{selectedIds.size} selected</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map(s => (
              <button
                key={s.id}
                onClick={() => batchUpdate(s.id)}
                disabled={updatingId === 'batch'}
                className="text-xs px-3 py-1.5 rounded-full bg-surface border border-border text-text-secondary hover:border-brand-400 hover:text-brand-700 transition-colors min-h-[32px]"
              >
                {s.label}
              </button>
            ))}
          </div>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-text-muted hover:text-reject">Clear</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="text-brand-500 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <Archive size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{searchQuery ? 'No items match your search' : 'No inventory items yet'}</p>
        </div>
      )}

      {/* Items list */}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {/* Select all header */}
          <div className="flex items-center gap-3 px-4 py-2 text-xs text-text-muted">
            <button onClick={selectAll} className="min-w-[20px] min-h-[20px] flex items-center justify-center">
              {selectedIds.size === items.length ? <CheckSquare size={16} className="text-brand-600" /> : <Square size={16} />}
            </button>
            <span className="w-24">SKU</span>
            <span className="flex-1">Title</span>
            <span className="w-16 text-right">Cost</span>
            <span className="w-16 text-right">Profit</span>
            <span className="w-12 text-right">Days</span>
            <span className="w-24 text-right">Status</span>
            <span className="w-6"></span>
          </div>

          {items.map(item => {
            const isExpanded = expandedId === item.id;
            const isSelected = selectedIds.has(item.id);
            const isUpdating = updatingId === item.id;
            const days = item.received_at ? daysInInventory(item.received_at) : 0;
            const profitPositive = (item.expected_profit_cents || 0) > 0;

            return (
              <div key={item.id} className={`bg-surface rounded-[var(--radius-lg)] border overflow-hidden ${isSelected ? 'border-brand-400 ring-1 ring-brand-400/30' : 'border-border'}`}>
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleSelect(item.id)} className="min-w-[20px] min-h-[20px] flex items-center justify-center flex-shrink-0">
                    {isSelected ? <CheckSquare size={16} className="text-brand-600" /> : <Square size={16} className="text-text-muted" />}
                  </button>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="flex-1 flex items-center gap-3 text-left min-h-[44px]"
                  >
                    <span className="w-24 font-mono text-xs text-brand-700 font-semibold flex-shrink-0 truncate">
                      {item.sku || '---'}
                    </span>

                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-sm text-text-primary truncate">{item.title || 'Untitled'}</span>
                      <CategoryBadge category={item.category} />
                    </div>

                    <span className="w-16 text-right text-sm font-mono text-text-primary flex-shrink-0">
                      {cents(item.cost_cents)}
                    </span>

                    <span className={`w-16 text-right text-sm font-mono font-semibold flex-shrink-0 ${profitPositive ? 'text-accept' : 'text-reject'}`}>
                      {cents(item.expected_profit_cents)}
                    </span>

                    <span className="w-12 text-right flex-shrink-0">
                      <DaysIndicator days={days} />
                    </span>

                    <span className="w-24 text-right flex-shrink-0">
                      <StatusBadge status={item.status} />
                    </span>

                    <ChevronDown size={14} className={`text-text-muted transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4 bg-background/30">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* ASIN & Amazon */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted mb-1 flex items-center gap-1"><Tag size={12} /> Product Info</p>
                        {item.asin ? (
                          <a href={`https://www.amazon.com/dp/${item.asin}`} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-brand-600 hover:underline flex items-center gap-1 font-mono">
                            ASIN: {item.asin} <ExternalLink size={12} />
                          </a>
                        ) : (
                          <p className="text-sm text-text-muted">No ASIN</p>
                        )}
                        {item.condition_received && (
                          <p className="text-xs text-text-secondary mt-1">
                            Received: <span className="capitalize">{item.condition_received}</span>
                          </p>
                        )}
                        {item.condition_graded && (
                          <p className="text-xs text-text-secondary">
                            Graded: <span className="capitalize">{item.condition_graded}</span>
                          </p>
                        )}
                      </div>

                      {/* Fee breakdown */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted mb-1 flex items-center gap-1"><DollarSign size={12} /> Fee Breakdown</p>
                        <div className="space-y-0.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Sell Price</span>
                            <span className="font-mono text-accept">{cents(item.sell_price_cents)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Referral Fee</span>
                            <span className="font-mono text-reject">-{cents(item.referral_fee_cents)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Closing Fee</span>
                            <span className="font-mono text-reject">-{cents(item.closing_fee_cents)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">FBA Fee</span>
                            <span className="font-mono text-reject">-{cents(item.fba_fee_cents)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Prep Fee</span>
                            <span className="font-mono text-reject">-{cents(item.prep_fee_cents)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Inbound Ship</span>
                            <span className="font-mono text-reject">-{cents(item.inbound_ship_cents)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Cost</span>
                            <span className="font-mono text-reject">-{cents(item.cost_cents)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-border font-semibold">
                            <span className="text-text-primary">Profit</span>
                            <span className={`font-mono ${profitPositive ? 'text-accept' : 'text-reject'}`}>{cents(item.expected_profit_cents)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted mb-1 flex items-center gap-1"><Calendar size={12} /> Timeline</p>
                        <div className="space-y-1 text-xs text-text-secondary">
                          {item.received_at && <p>Received: {new Date(item.received_at).toLocaleDateString()}</p>}
                          {item.graded_at && <p>Graded: {new Date(item.graded_at).toLocaleDateString()}</p>}
                          {item.listed_at && <p>Listed: {new Date(item.listed_at).toLocaleDateString()}</p>}
                          {item.sold_at && <p>Sold: {new Date(item.sold_at).toLocaleDateString()}</p>}
                        </div>
                        {item.amazon_listing_id && (
                          <p className="text-xs text-text-muted mt-2 font-mono">
                            Listing: {item.amazon_listing_id}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {item.notes && (
                      <div>
                        <p className="text-xs font-semibold text-text-muted mb-1">Notes</p>
                        <p className="text-sm text-text-secondary bg-surface px-3 py-2 rounded-md">{item.notes}</p>
                      </div>
                    )}

                    {/* Status actions */}
                    <div>
                      <p className="text-xs font-semibold text-text-muted mb-2">Update Status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.filter(s => s.id !== item.status).map(s => {
                          const Icon = s.icon;
                          return (
                            <button
                              key={s.id}
                              onClick={() => updateStatus(item.id, s.id)}
                              disabled={isUpdating}
                              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary hover:border-brand-400 hover:text-brand-700 transition-colors min-h-[32px] disabled:opacity-50"
                            >
                              <Icon size={11} />{s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-[10px] text-text-muted font-mono">
                      SKU: {item.sku || '---'} | Order: {item.order_id || '---'} | ID: {item.id}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

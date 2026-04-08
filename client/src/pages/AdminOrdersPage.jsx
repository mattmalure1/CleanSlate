import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../api';
import {
  Package, Truck, ClipboardCheck, DollarSign, Clock, Search,
  ChevronDown, ExternalLink, Mail, MapPin, RefreshCw, Database,
  CheckCircle, XCircle, Download, CheckSquare, Square, BarChart3,
  ArrowRight, Archive,
} from 'lucide-react';

const STATUSES = [
  { id: 'pending', label: 'Pending', color: 'bg-warning-light text-warning', icon: Clock },
  { id: 'label_created', label: 'Label Created', color: 'bg-brand-100 text-brand-700', icon: Truck },
  { id: 'shipped', label: 'Shipped', color: 'bg-brand-100 text-brand-700', icon: Truck },
  { id: 'received', label: 'Received', color: 'bg-brand-200 text-brand-800', icon: Package },
  { id: 'grading', label: 'Grading', color: 'bg-brand-200 text-brand-800', icon: ClipboardCheck },
  { id: 'graded', label: 'Graded', color: 'bg-accept-light text-accept', icon: CheckCircle },
  { id: 'paid', label: 'Paid', color: 'bg-accept-light text-accept', icon: DollarSign },
  { id: 'cancelled', label: 'Cancelled', color: 'bg-reject-light text-reject', icon: XCircle },
];

function cents(v) { return v ? `$${(v / 100).toFixed(2)}` : '$0.00'; }

function StatusBadge({ status }) {
  const s = STATUSES.find(st => st.id === status) || STATUSES[0];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.color}`}>
      <Icon size={12} />{s.label}
    </span>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [payoutId, setPayoutId] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(apiUrl(`/api/admin/orders?${params}`));
      const data = await res.json();
      setOrders(data.orders || []);
      setStats(data.stats || {});
    } catch { setOrders([]); }
    setLoading(false);
  }, [filter, searchQuery]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function updateStatus(orderId, newStatus) {
    setUpdatingId(orderId);
    try {
      await fetch(apiUrl(`/api/admin/order/${orderId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchOrders();
    } catch { /* ignore */ }
    setUpdatingId(null);
  }

  async function batchUpdate(newStatus) {
    if (selectedIds.size === 0) return;
    setUpdatingId('batch');
    try {
      await fetch(apiUrl('/api/admin/orders/batch'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: [...selectedIds],
          status: newStatus,
          payoutTransactionId: payoutId || undefined,
        }),
      });
      setSelectedIds(new Set());
      setPayoutId('');
      fetchOrders();
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
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)));
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-[var(--spacing-page)] py-6">
      {/* Admin nav */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <Link to="/admin" className="text-text-muted hover:text-brand-700 flex items-center gap-1">
          <Database size={14} /> Product Review
        </Link>
        <span className="text-text-muted">/</span>
        <span className="text-text-primary font-semibold flex items-center gap-1">
          <Package size={14} /> Orders
        </span>
        <span className="text-text-muted">/</span>
        <Link to="/admin/inventory" className="text-text-muted hover:text-brand-700 flex items-center gap-1">
          <Archive size={14} /> Inventory
        </Link>
        <span className="text-text-muted">/</span>
        <Link to="/admin/quotes" className="text-text-muted hover:text-brand-700 flex items-center gap-1">
          <ClipboardCheck size={14} /> Quotes
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Total Orders</p>
          <p className="font-display font-bold text-2xl text-text-primary">{stats.total || 0}</p>
        </div>
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Total Items</p>
          <p className="font-display font-bold text-2xl text-text-primary">{stats.totalItems || 0}</p>
        </div>
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Unpaid Payouts</p>
          <p className="font-display font-bold text-2xl text-warning">{cents(stats.unpaidPayoutCents)}</p>
        </div>
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-xs text-text-muted">Total Committed</p>
          <p className="font-display font-bold text-2xl text-brand-700">{cents(stats.totalPayoutCents)}</p>
        </div>
      </div>

      {/* Pipeline (mini kanban) */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mb-6">
        {['pending', 'label_created', 'shipped', 'received', 'grading', 'graded', 'paid'].map(s => {
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
            placeholder="Search name, email, ISBN, tracking..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[var(--radius-md)] border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500/30 min-h-[44px]"
          />
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-1.5 text-sm text-text-secondary px-3 py-2 rounded-[var(--radius-md)] border border-border hover:border-brand-400 transition-colors min-h-[44px]"
        >
          <RefreshCw size={14} /> Refresh
        </button>
        <a
          href={apiUrl("/api/admin/orders/export")}
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
            {['shipped', 'received', 'grading', 'graded', 'paid'].map(s => (
              <button
                key={s}
                onClick={() => batchUpdate(s)}
                disabled={updatingId === 'batch'}
                className="text-xs px-3 py-1.5 rounded-full bg-surface border border-border text-text-secondary hover:border-brand-400 hover:text-brand-700 transition-colors min-h-[32px]"
              >
                {STATUSES.find(x => x.id === s)?.label}
              </button>
            ))}
          </div>
          {/* Payout ID for batch "paid" */}
          <input
            type="text"
            value={payoutId}
            onChange={e => setPayoutId(e.target.value)}
            placeholder="PayPal/Venmo transaction ID (optional)"
            className="text-xs px-3 py-1.5 rounded-[var(--radius-md)] border border-border bg-surface text-text-primary placeholder:text-text-muted min-h-[32px] w-64"
          />
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
      {!loading && orders.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{searchQuery ? 'No orders match your search' : 'No orders yet'}</p>
        </div>
      )}

      {/* Orders list */}
      {!loading && orders.length > 0 && (
        <div className="space-y-2">
          {/* Select all header */}
          <div className="flex items-center gap-3 px-4 py-2 text-xs text-text-muted">
            <button onClick={selectAll} className="min-w-[20px] min-h-[20px] flex items-center justify-center">
              {selectedIds.size === orders.length ? <CheckSquare size={16} className="text-brand-600" /> : <Square size={16} />}
            </button>
            <span className="flex-1">Customer</span>
            <span className="w-20 text-right">Amount</span>
            <span className="w-24 text-right">Status</span>
            <span className="w-16"></span>
          </div>

          {orders.map(order => {
            const isExpanded = expandedId === order.id;
            const isSelected = selectedIds.has(order.id);
            const customer = order.customers || {};
            const items = order.order_items || [];
            const isUpdating = updatingId === order.id;

            return (
              <div key={order.id} className={`bg-surface rounded-[var(--radius-lg)] border overflow-hidden ${isSelected ? 'border-brand-400 ring-1 ring-brand-400/30' : 'border-border'}`}>
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleSelect(order.id)} className="min-w-[20px] min-h-[20px] flex items-center justify-center flex-shrink-0">
                    {isSelected ? <CheckSquare size={16} className="text-brand-600" /> : <Square size={16} className="text-text-muted" />}
                  </button>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    className="flex-1 flex items-center gap-3 text-left min-h-[44px]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-text-primary">{customer.name || 'Unknown'}</span>
                        <span className="text-xs text-text-muted">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                        <span className="text-xs text-text-muted">{timeAgo(order.created_at)}</span>
                      </div>
                      <p className="text-xs text-text-muted truncate mt-0.5">
                        {items.map(i => i.title).join(', ')}
                      </p>
                    </div>

                    <span className="font-display font-bold text-base text-text-primary w-20 text-right flex-shrink-0">
                      {cents(order.total_offer_cents)}
                    </span>

                    <span className="w-24 text-right flex-shrink-0">
                      <StatusBadge status={order.status} />
                    </span>

                    <ChevronDown size={14} className={`text-text-muted transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4 bg-background/30">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Customer */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted mb-1 flex items-center gap-1"><Mail size={12} /> Customer</p>
                        <p className="text-sm text-text-primary font-medium">{customer.name}</p>
                        <p className="text-sm text-text-secondary">{customer.email}</p>
                        <p className="text-xs text-text-muted mt-1 capitalize">Payout: {customer.payout_method} {customer.payout_details ? `(${customer.payout_details})` : ''}</p>
                      </div>
                      {/* Address */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted mb-1 flex items-center gap-1"><MapPin size={12} /> Ship From</p>
                        {customer.address && (
                          <>
                            <p className="text-sm text-text-primary">{customer.address.street}</p>
                            <p className="text-sm text-text-secondary">{customer.address.city}, {customer.address.state} {customer.address.zip}</p>
                          </>
                        )}
                      </div>
                      {/* Tracking */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted mb-1 flex items-center gap-1"><Truck size={12} /> Shipping</p>
                        {order.tracking_number ? (
                          <>
                            <a href={`https://tools.usps.com/go/TrackConfirmAction_input?origTrackNum=${order.tracking_number}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-sm text-brand-600 hover:underline flex items-center gap-1">
                              {order.tracking_number} <ExternalLink size={12} />
                            </a>
                            {order.label_url && (
                              <a href={order.label_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-brand-600 hover:underline mt-1 block">View Label</a>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-text-muted">No label yet</p>
                        )}
                      </div>
                    </div>

                    {/* Items */}
                    <div>
                      <p className="text-xs font-semibold text-text-muted mb-2">Items ({items.length})</p>
                      <div className="space-y-1">
                        {items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-surface text-sm">
                            <span className="text-text-primary truncate flex-1">{item.title}</span>
                            {item.category && <span className="text-xs text-text-muted bg-background px-1.5 py-0.5 rounded capitalize mx-2 flex-shrink-0">{item.category}</span>}
                            <span className="font-mono font-semibold text-text-primary flex-shrink-0">{cents(item.offered_price_cents)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                      <div>
                        <p className="text-xs font-semibold text-text-muted mb-1">Notes</p>
                        <p className="text-sm text-text-secondary bg-surface px-3 py-2 rounded-md">{order.notes}</p>
                      </div>
                    )}

                    {/* Status actions */}
                    <div>
                      <p className="text-xs font-semibold text-text-muted mb-2">Update Status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.filter(s => s.id !== order.status && s.id !== 'cancelled').map(s => {
                          const Icon = s.icon;
                          return (
                            <button
                              key={s.id}
                              onClick={() => updateStatus(order.id, s.id)}
                              disabled={isUpdating}
                              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary hover:border-brand-400 hover:text-brand-700 transition-colors min-h-[32px] disabled:opacity-50"
                            >
                              <Icon size={11} />{s.label}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => updateStatus(order.id, 'cancelled')}
                          disabled={isUpdating}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-reject/20 text-reject hover:bg-reject-light transition-colors min-h-[32px] disabled:opacity-50"
                        >
                          <XCircle size={11} />Cancel
                        </button>
                      </div>
                    </div>

                    <p className="text-[10px] text-text-muted font-mono">ID: {order.id} | Created: {new Date(order.created_at).toLocaleString()}</p>
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

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl, adminFetch } from '../api';
import {
  ShieldX, Plus, Trash2, RefreshCw, ArrowLeft, RotateCcw,
  Tag, Hash,
} from 'lucide-react';

export default function AdminGatedItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [newPattern, setNewPattern] = useState('');
  const [newType, setNewType] = useState('brand');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/gated-items');
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to load gated items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addItem = async (e) => {
    e.preventDefault();
    if (!newPattern.trim()) return;
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/gated-items', {
        method: 'POST',
        body: JSON.stringify({
          pattern: newPattern.trim(),
          match_type: newType,
          reason: newReason.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNewPattern('');
      setNewReason('');
      setAddMode(false);
      await load();
    } catch (err) {
      alert('Failed to add: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id) => {
    try {
      await adminFetch(`/api/admin/gated-items/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      alert('Failed to remove: ' + err.message);
    }
  };

  const reactivate = async (id) => {
    try {
      await adminFetch(`/api/admin/gated-items/${id}/reactivate`, { method: 'POST' });
      await load();
    } catch (err) {
      alert('Failed to reactivate: ' + err.message);
    }
  };

  const activeItems = items.filter(i => i.active);
  const inactiveItems = items.filter(i => !i.active);
  const visibleItems = showInactive ? items : activeItems;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link to="/admin" className="text-text-muted hover:text-text-primary">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <ShieldX size={24} /> Gated Items
        </h1>
      </div>
      <p className="text-sm text-text-muted mb-6 ml-7">
        Brands and ASINs you can't sell on Amazon FBA. The offer engine rejects these at Step 3.
        Changes take effect after a server restart.
      </p>

      {/* Actions bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAddMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
          >
            <Plus size={16} /> Add
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-text-muted hover:bg-gray-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Show removed ({inactiveItems.length})
        </label>
      </div>

      {/* Add form */}
      {addMode && (
        <form onSubmit={addItem} className="bg-brand-50 border border-brand-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-white"
            >
              <option value="brand">Brand name</option>
              <option value="asin">Specific ASIN</option>
            </select>
            <input
              type="text"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder={newType === 'brand' ? 'e.g. disney, warner bros' : 'e.g. B00ABC1234'}
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm"
              autoFocus
            />
          </div>
          <input
            type="text"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Reason (optional) — e.g. Brand gating, can't list on FBA"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving || !newPattern.trim()}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add to blocklist'}
            </button>
            <button
              type="button"
              onClick={() => { setAddMode(false); setNewPattern(''); setNewReason(''); }}
              className="px-4 py-2 border border-border rounded-lg text-sm text-text-muted hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          {newType === 'brand' && (
            <p className="text-xs text-text-muted">
              Brand matches are case-insensitive substrings checked against the product's brand, manufacturer, and title fields.
            </p>
          )}
        </form>
      )}

      {/* Items list */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading...</div>
      ) : visibleItems.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          No gated items yet. Click "Add" to block a brand or ASIN.
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium text-text-muted">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-muted">Pattern</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-muted">Reason</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-muted">Added</th>
                <th className="text-right px-4 py-2.5 font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-border last:border-0 ${!item.active ? 'opacity-40 bg-gray-50' : ''}`}
                >
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.match_type === 'brand'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.match_type === 'brand' ? <Tag size={12} /> : <Hash size={12} />}
                      {item.match_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-text-primary">{item.pattern}</td>
                  <td className="px-4 py-2.5 text-text-muted">{item.reason || '—'}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {new Date(item.added_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {item.active ? (
                      <button
                        onClick={() => deactivate(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove from blocklist"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivate(item.id)}
                        className="text-brand-600 hover:text-brand-700 p-1"
                        title="Re-add to blocklist"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats footer */}
      <div className="mt-4 text-xs text-text-muted text-center">
        {activeItems.length} active gated {activeItems.length === 1 ? 'item' : 'items'}
        {inactiveItems.length > 0 && ` · ${inactiveItems.length} removed`}
        {' · '}Server restart required after changes
      </div>
    </div>
  );
}

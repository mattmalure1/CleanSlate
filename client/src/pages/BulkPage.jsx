import { useState, useCallback, useRef } from 'react';
import {
  Camera, Upload, List, Zap, Loader2, CheckCircle, XCircle,
  ShoppingCart, Trash2, FileText, Plus, ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';
import { useCart } from '../context/CartContext';
import BarcodeScanner from '../components/BarcodeScanner';

const TABS = [
  { id: 'rapid', label: 'Rapid Scan', icon: Zap, desc: 'Scan barcodes one after another' },
  { id: 'paste', label: 'Paste ISBNs', icon: List, desc: 'Paste a list of ISBNs' },
  { id: 'csv', label: 'Upload File', icon: Upload, desc: 'Upload a CSV or text file' },
];


function cents(v) {
  return `$${(v / 100).toFixed(2)}`;
}

export default function BulkPage() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [activeTab, setActiveTab] = useState('rapid');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [addedIds, setAddedIds] = useState(new Set());
  const fileRef = useRef(null);

  // Process a single code (for rapid scan)
  const lookupSingle = useCallback(async (code) => {
    try {
      const res = await fetch(apiUrl(`/api/quote?code=${encodeURIComponent(code)}&hasCase=true&condition=good`));
      const data = await res.json();
      if (!res.ok) {
        return { code, status: 'rejected', reason: 'not_found', message: data.error || "Not found", offerCents: 0, offerDisplay: '$0.00' };
      }
      return { code, ...data };
    } catch {
      return { code, status: 'rejected', reason: 'error', message: 'Lookup failed', offerCents: 0, offerDisplay: '$0.00' };
    }
  }, []);

  // Rapid scan: each barcode detected adds to results
  // BarcodeScanner handles its own lookups and results display
  // This is a no-op — scanner manages everything internally
  const handleRapidScan = useCallback(() => {}, []);

  // Bulk lookup: paste or CSV
  const processBulk = useCallback(async (codes) => {
    const cleaned = codes
      .map(c => c.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(c => c.length >= 10);

    if (cleaned.length === 0) return;
    setLoading(true);

    try {
      const res = await fetch(apiUrl('/api/bulk-quote'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: cleaned, hasCase: true, condition: 'good' }),
      });
      const data = await res.json();
      if (data.results) {
        setResults(prev => [...data.results, ...prev]);
      }
    } catch {
      // Fallback: process one by one
      for (const code of cleaned) {
        const result = await lookupSingle(code);
        setResults(prev => [result, ...prev]);
      }
    }
    setLoading(false);
  }, [lookupSingle]);

  // Handle paste submit
  function handlePasteSubmit(e) {
    e.preventDefault();
    const codes = pasteText
      .split(/[\n,;\t]+/)
      .map(s => s.trim())
      .filter(Boolean);
    processBulk(codes);
    setPasteText('');
  }

  // Handle CSV/text file upload
  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result || '';
      const codes = text
        .split(/[\n,;\t\r]+/)
        .map(s => s.trim().replace(/"/g, ''))
        .filter(s => s.length >= 10);
      processBulk(codes);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  // Add single result to cart
  function handleAddToCart(result) {
    if (result.status === 'rejected') return;
    addItem({
      asin: result.asin,
      title: result.title,
      imageUrl: result.imageUrl,
      offerCents: result.offerCents,
      offerDisplay: result.offerDisplay,
      category: result.category,
      isDisc: result.isDisc,
      hasCase: result.hasCase,
      color: result.color,
      label: result.label,
    });
    setAddedIds(prev => new Set([...prev, result.code]));
  }

  // Add all accepted to cart
  function handleAddAllToCart() {
    const accepted = results.filter(r => r.status === 'accepted' || r.status === 'low');
    accepted.forEach(r => {
      if (!addedIds.has(r.code)) handleAddToCart(r);
    });
  }

  // Remove a result
  function removeResult(code) {
    setResults(prev => prev.filter(r => r.code !== code));
  }

  // Clear all results
  function clearAll() {
    setResults([]);
    setAddedIds(new Set());
  }

  const accepted = results.filter(r => r.status === 'accepted' || r.status === 'low');
  const rejected = results.filter(r => r.status === 'rejected');
  const totalCents = accepted.reduce((sum, r) => sum + r.offerCents, 0);

  return (
    <div className="max-w-3xl mx-auto px-[var(--spacing-page)] py-6">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand-700 mb-4 min-h-[44px]"
      >
        <ArrowLeft size={16} />
        Back to home
      </button>

      <h1 className="font-display font-bold text-2xl text-text-primary mb-2">
        Bulk Sell
      </h1>
      <p className="text-text-secondary text-sm mb-6">
        Add multiple items at once — scan barcodes rapidly, paste a list of ISBNs, or upload a file.
      </p>

      {/* Input method tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-3 rounded-[var(--radius-lg)] text-sm font-semibold transition-all min-h-[44px] ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface border border-border text-text-secondary hover:border-brand-400'
              }`}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Rapid Scan */}
      {activeTab === 'rapid' && (
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5 mb-6">
          <p className="text-sm text-text-secondary mb-4">
            Point your camera at barcodes one after another. Each scan automatically looks up the item and adds it to your list.
          </p>
          <button
            onClick={() => setScannerOpen(true)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-4 rounded-[var(--radius-xl)] transition-all min-h-[56px]"
          >
            <Camera size={22} />
            {loading ? 'Looking up...' : scannerOpen ? 'Scanning...' : 'Start Rapid Scanning'}
          </button>
          {loading && (
            <div className="flex items-center gap-2 mt-3 text-brand-600">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Looking up item...</span>
            </div>
          )}
        </div>
      )}

      {/* Paste ISBNs */}
      {activeTab === 'paste' && (
        <form onSubmit={handlePasteSubmit} className="bg-surface rounded-[var(--radius-lg)] border border-border p-5 mb-6">
          <p className="text-sm text-text-secondary mb-3">
            Paste ISBNs or UPCs, one per line or separated by commas.
          </p>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={"9780134580999\n9780134685991\n9781975163259"}
            rows={6}
            className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-y"
          />
          <button
            type="submit"
            disabled={loading || !pasteText.trim()}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-text-muted text-white font-semibold py-3 rounded-[var(--radius-lg)] transition-all min-h-[48px]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <List size={18} />}
            {loading ? 'Looking up...' : 'Look Up All'}
          </button>
        </form>
      )}

      {/* CSV Upload */}
      {activeTab === 'csv' && (
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5 mb-6">
          <p className="text-sm text-text-secondary mb-3">
            Upload a .csv or .txt file with ISBNs/UPCs (one per line, or in the first column).
          </p>
          <label className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-border rounded-[var(--radius-lg)] cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all">
            <FileText size={32} className="text-text-muted" />
            <span className="text-sm font-semibold text-text-secondary">Click to choose file</span>
            <span className="text-xs text-text-muted">.csv, .txt, or .tsv</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <a
            href="/cleanslate-upload-template.csv"
            download
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium cursor-pointer"
          >
            <FileText size={14} />
            Download template spreadsheet
          </a>
          {loading && (
            <div className="flex items-center gap-2 mt-3 text-brand-600">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Processing file...</span>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-text-muted">Items Found</p>
                <p className="font-display font-bold text-lg text-text-primary">{results.length}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Accepted</p>
                <p className="font-display font-bold text-lg text-accept">{accepted.length}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Rejected</p>
                <p className="font-display font-bold text-lg text-reject">{rejected.length}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Total Offer</p>
                <p className="font-display font-bold text-lg text-brand-700">{cents(totalCents)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {accepted.length > 0 && (
                <button
                  onClick={handleAddAllToCart}
                  className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-4 py-2 rounded-[var(--radius-md)] transition-colors min-h-[44px]"
                >
                  <ShoppingCart size={16} />
                  Add All to Cart
                </button>
              )}
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 text-text-muted hover:text-reject text-sm px-3 py-2 rounded-[var(--radius-md)] transition-colors min-h-[44px]"
              >
                <Trash2 size={14} />
                Clear
              </button>
            </div>
          </div>

          {/* Results list */}
          <div className="space-y-2">
            {results.map((r, i) => {
              const isAccepted = r.status === 'accepted' || r.status === 'low';
              const inCart = addedIds.has(r.code);
              return (
                <div
                  key={`${r.code}-${i}`}
                  className={`flex items-center gap-3 p-3 rounded-[var(--radius-md)] border ${
                    isAccepted ? 'bg-accept-light/30 border-accept/10' : 'bg-reject-light/30 border-reject/10'
                  }`}
                >
                  {r.imageUrl && (
                    <img src={r.imageUrl} alt="" className="w-12 h-12 rounded-md object-cover bg-background flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {r.title || r.code}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {r.category && (
                        <span className="text-xs text-text-muted bg-background px-1.5 py-0.5 rounded capitalize">{r.category}</span>
                      )}
                      <span className="text-xs text-text-muted font-mono">{r.code}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {isAccepted ? (
                      <>
                        <p className="font-display font-bold text-lg text-text-primary">{r.offerDisplay}</p>
                        <button
                          onClick={() => handleAddToCart(r)}
                          disabled={inCart}
                          className={`mt-1 text-xs font-semibold px-3 py-1 rounded-full transition-colors min-h-[44px] ${
                            inCart
                              ? 'bg-accept/20 text-accept'
                              : 'bg-brand-600 text-white hover:bg-brand-700'
                          }`}
                        >
                          {inCart ? 'In Cart' : '+ Add'}
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1 text-reject">
                        <XCircle size={14} />
                        <span className="text-xs font-semibold">No offer</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeResult(r.code)}
                    className="text-text-muted hover:text-reject p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scanner modal */}
      {scannerOpen && (
        <BarcodeScanner
          onScan={handleRapidScan}
          onClose={() => setScannerOpen(false)}
          rapid={true}
        />
      )}
    </div>
  );
}

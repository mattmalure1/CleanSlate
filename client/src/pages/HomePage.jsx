import { useState, useCallback, useRef } from 'react';
import {
  Camera, Search, Loader2, ArrowUp, ScanBarcode, DollarSign, Truck,
  Wallet, Check, X, ShieldCheck, Zap, Package, ChevronRight,
} from 'lucide-react';
import { useQuote } from '../hooks/useQuote';
import BarcodeScanner from '../components/BarcodeScanner';
import QuoteCard from '../components/QuoteCard';
import FAQ from '../components/FAQ';

const CATEGORIES = [
  { id: 'book', label: 'Books' },
  { id: 'dvd', label: 'DVDs & Blu-rays' },
  { id: 'cd', label: 'CDs' },
  { id: 'game', label: 'Video Games' },
];

const STEPS = [
  { icon: ScanBarcode, title: 'Get Instant Quotes', desc: 'Scan a barcode or enter an ISBN/UPC. See your offer in seconds.' },
  { icon: Truck, title: 'Ship for Free', desc: 'We email you a prepaid USPS Media Mail label. Just pack and drop off.' },
  { icon: Wallet, title: 'Get Paid Fast', desc: 'Choose PayPal, Venmo, or check. Payment sent within 2-3 business days.' },
];

const US_VS_THEM = [
  { us: 'Instant offer before you ship', them: 'List it, wait days, deal with buyers' },
  { us: 'Free prepaid shipping label', them: 'Pay for shipping yourself' },
  { us: 'No fees or commissions', them: '10-15% marketplace fees' },
  { us: 'Paid in 2-3 business days', them: 'Wait for buyer, risk chargebacks' },
  { us: 'Send everything in one box', them: 'Create separate listings for each item' },
];

export default function HomePage() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('book');
  const { loading, result, error, fetchQuote, requote, setResult } = useQuote();
  const searchRef = useRef(null);

  const handleScan = useCallback(() => {}, []);
  function handleSearch(e) { e.preventDefault(); const q = searchQuery.trim(); if (q) fetchQuote(q); }
  function handleCaseToggle(hasCase) { if (result?.asin) requote(result.asin, hasCase); }
  function scrollToSearch() { searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

  const placeholders = {
    book: 'Enter ISBN (e.g. 9780134580999)',
    dvd: 'Enter UPC (12-digit number under barcode)',
    cd: 'Enter UPC (12-digit number under barcode)',
    game: 'Enter UPC (12-digit number under barcode)',
  };

  return (
    <div>
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-brand-800">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        <div className="relative max-w-3xl mx-auto px-[var(--spacing-page)] pt-12 pb-14 text-center">
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-[3.5rem] text-white leading-[1.1] tracking-tight">
            Sell Your Used Media
            <br />
            <span className="bg-gradient-to-r from-brand-300 to-brand-200 bg-clip-text text-transparent">For Cash</span>
          </h1>
          <p className="mt-4 text-brand-200/90 text-lg max-w-md mx-auto leading-relaxed">
            Books, DVDs, CDs, and video games. Instant offers, free shipping, fast payment.
          </p>

          {/* Category tabs */}
          <div className="flex justify-center gap-2 mt-8 flex-wrap" role="tablist">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                role="tab"
                aria-selected={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all min-h-[44px] cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-white text-brand-800 shadow-md shadow-black/10'
                    : 'bg-white/10 text-white/90 hover:bg-white/20 backdrop-blur-sm'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Scan button — big and obvious */}
          <button
            onClick={() => { setScannerOpen(true); setResult(null); setSearchQuery(''); }}
            className="mt-6 mx-auto flex items-center justify-center gap-3 bg-white hover:bg-brand-50 text-brand-700 font-bold text-lg px-8 py-4 rounded-2xl shadow-xl shadow-black/15 cursor-pointer active:scale-[0.97] min-h-[60px]"
          >
            <Camera size={24} />
            Scan Barcode
          </button>

          {/* Search bar */}
          <form ref={searchRef} onSubmit={handleSearch} className="mt-4 relative max-w-xl mx-auto">
            <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={placeholders[activeCategory]}
              className="w-full pl-13 pr-28 py-3.5 rounded-2xl bg-white/90 text-text-primary placeholder:text-text-muted text-base focus:outline-none focus:ring-3 focus:ring-brand-400/40 min-h-[52px] shadow-lg shadow-black/10"
            />
            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-5 h-10 flex items-center justify-center rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm cursor-pointer"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Get Quote'}
            </button>
          </form>
          <p className="mt-2 text-xs text-white/50">Or type an ISBN / UPC above</p>

          {/* Trust badges */}
          <div className="flex justify-center items-center gap-6 sm:gap-8 mt-7 text-white/70 text-sm">
            <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-brand-300" /> No Fees</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span className="flex items-center gap-1.5"><Package size={16} className="text-brand-300" /> Free Shipping</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span className="flex items-center gap-1.5"><Zap size={16} className="text-brand-300" /> Fast Payment</span>
          </div>

          {/* Social proof line */}
          <p className="mt-4 text-white/50 text-xs tracking-wide">
            Serving sellers nationwide — books, textbooks, DVDs, CDs, and video games
          </p>
        </div>
      </section>

      {/* ─── QUOTE RESULT ─── */}
      <div className="max-w-3xl mx-auto px-[var(--spacing-page)]">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 size={32} className="text-brand-500 animate-spin" />
            <p className="text-sm text-text-muted">Looking up your item...</p>
          </div>
        )}
        {error && !loading && (
          <div className="bg-reject-light border border-reject/20 rounded-[var(--radius-lg)] p-4 text-center mt-6">
            <p className="text-sm text-reject font-medium">{error}</p>
            <p className="mt-1 text-xs text-text-muted">Try a different barcode or search term.</p>
          </div>
        )}
        {result && !loading && (
          <div className="mt-6 mb-2">
            <QuoteCard data={result} onCaseToggle={handleCaseToggle} />
          </div>
        )}
      </div>

      {/* ─── HOW IT WORKS ─── */}
      <section className="max-w-3xl mx-auto px-[var(--spacing-page)] py-16">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary text-center">
          How It Works
        </h2>
        <p className="text-text-secondary text-center mt-2 mb-12">Three steps. That's it.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="flex flex-col items-center text-center group">
                <div className="relative mb-5">
                  <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:shadow-brand-500/30 group-hover:scale-105">
                    <Icon size={32} className="text-white" strokeWidth={1.6} />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-brand-900 text-white text-xs font-bold flex items-center justify-center ring-2 ring-background">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-text-primary">{step.title}</h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-[220px]">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── US VS THEM ─── */}
      <section className="bg-brand-50/60 border-y border-brand-100/60">
        <div className="max-w-3xl mx-auto px-[var(--spacing-page)] py-16">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary text-center">
            Why CleanSlate?
          </h2>
          <p className="text-text-secondary text-center mt-2 mb-10">
            Skip the hassle of selling on marketplaces
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white border border-accept/20 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-5">
                <img src="/logo-icon.jpg" alt="" className="h-6 w-auto rounded" />
                <h3 className="font-display font-bold text-base text-text-primary">CleanSlate</h3>
              </div>
              <ul className="space-y-3.5">
                {US_VS_THEM.map((row, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-text-primary leading-snug">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-accept/10 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-accept" strokeWidth={3} />
                    </span>
                    {row.us}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/60 border border-border rounded-2xl p-6">
              <h3 className="font-display font-bold text-base text-text-muted mb-5">
                Selling Yourself
              </h3>
              <ul className="space-y-3.5">
                {US_VS_THEM.map((row, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-text-muted leading-snug">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-reject/5 flex items-center justify-center flex-shrink-0">
                      <X size={12} className="text-reject/40" strokeWidth={3} />
                    </span>
                    {row.them}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURE BAR ─── */}
      <section className="bg-gradient-to-r from-brand-800 to-brand-900">
        <div className="max-w-5xl mx-auto px-[var(--spacing-page)] py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { icon: Wallet, title: 'Get Paid Fast', desc: '1-Day Order Processing' },
              { icon: ShieldCheck, title: 'Risk Free', desc: 'Quote Guarantee' },
              { icon: Package, title: 'No Fees &', desc: 'Free Shipping' },
              { icon: ScanBarcode, title: 'Bulk', desc: 'Checkout' },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <Icon size={24} className="text-white/80" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm text-white">{f.title}</p>
                    <p className="text-xs text-brand-300">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── REVIEWS ─── */}
      <section className="bg-white">
        <div className="max-w-4xl mx-auto px-[var(--spacing-page)] py-14">
          <p className="text-brand-600 font-semibold text-sm text-center tracking-wide uppercase">Reviews & Rating</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary text-center mt-2">
            What Our Sellers Say
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {[
              { name: 'Sarah M.', date: '2 days ago', rating: 5, title: 'Super easy process', text: 'Scanned my textbooks, got instant quotes, shipped for free. Payment hit my PayPal in 2 days. Will definitely use again!' },
              { name: 'James R.', date: '5 days ago', rating: 5, title: 'Best prices I found', text: 'Compared CleanSlate to three other buyback sites. They offered the most for my nursing textbooks. Process was seamless.' },
              { name: 'Maria L.', date: '1 week ago', rating: 5, title: 'Great for bulk selling', text: 'Had about 30 DVDs and old textbooks. The bulk scan feature saved me so much time. Got paid $127 total.' },
              { name: 'David K.', date: '1 week ago', rating: 4, title: 'Fast and reliable', text: 'Shipped my books on Monday, got paid Thursday. Only wish they accepted vinyl records too!' },
              { name: 'Ashley T.', date: '2 weeks ago', rating: 5, title: 'Finally cleaned my shelf', text: 'Had boxes of old textbooks from college. CleanSlate made it so easy to turn them into cash. Free shipping was the cherry on top.' },
              { name: 'Mike P.', date: '2 weeks ago', rating: 5, title: 'Smooth experience', text: 'The barcode scanner worked perfectly on my phone. Added 12 items in under 2 minutes. Highly recommend.' },
            ].map((review, i) => (
              <div key={i} className="bg-background rounded-2xl p-5 border border-border/60">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <svg key={j} viewBox="0 0 20 20" className={`w-4 h-4 ${j < review.rating ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-xs text-accept font-semibold ml-1">Verified</span>
                </div>
                <h4 className="font-display font-bold text-sm text-text-primary">{review.title}</h4>
                <p className="mt-1.5 text-sm text-text-secondary leading-relaxed line-clamp-3">{review.text}</p>
                <p className="mt-3 text-xs text-text-muted">
                  <span className="font-semibold text-text-secondary">{review.name}</span> · {review.date}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <div className="bg-background">
        <FAQ />
      </div>

      {/* ─── FINAL CTA ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative max-w-3xl mx-auto px-[var(--spacing-page)] py-16 text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Ready to declutter?
          </h2>
          <p className="mt-3 text-base text-brand-200/90">
            Get an instant quote for your items. No obligation, no fees.
          </p>
          <button
            onClick={scrollToSearch}
            className="mt-6 inline-flex items-center gap-2 bg-white hover:bg-brand-50 active:scale-[0.97] text-brand-700 font-bold text-base px-8 py-4 rounded-2xl shadow-xl shadow-black/15 cursor-pointer"
          >
            <ArrowUp size={18} />
            Start Selling
          </button>
        </div>
      </section>

      {scannerOpen && <BarcodeScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />}
    </div>
  );
}

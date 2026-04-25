import { useState, useCallback, useRef } from 'react';
import {
  Camera, Search, Loader2, ArrowRight, ScanBarcode, DollarSign, Truck,
  Wallet, Check, X, ShieldCheck, Zap, Package, BookOpen, Disc3, Gamepad2, Music,
} from 'lucide-react';
import { useQuote } from '../hooks/useQuote';
import BarcodeScanner from '../components/BarcodeScanner';
import QuoteCard from '../components/QuoteCard';
import FAQ from '../components/FAQ';

const STEPS = [
  { image: '/images/scan-barcode.png', title: 'Get Instant Quotes', desc: 'Scan a barcode or enter an ISBN/UPC. See your offer in seconds.' },
  { image: '/images/ship-box.png', title: 'Ship for Free', desc: 'We email you a prepaid USPS Media Mail label. Just pack and drop off.' },
  { image: '/images/get-paid.png', title: 'Get Paid Fast', desc: 'Choose PayPal, Venmo, or check. Payment sent within 2-3 business days.' },
];

const WHAT_WE_BUY = [
  { icon: BookOpen, label: 'Books' },
  { icon: Disc3, label: 'DVDs & Blu-rays' },
  { icon: Music, label: 'CDs' },
  { icon: Gamepad2, label: 'Video Games' },
];

export default function HomePage() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { loading, result, error, fetchQuote, requote, setResult } = useQuote();
  const searchRef = useRef(null);

  const handleScan = useCallback(() => {}, []);
  function handleSearch(e) { e.preventDefault(); const q = searchQuery.trim(); if (q) fetchQuote(q); }
  function handleCaseToggle(hasCase) { if (result?.asin) requote(result.asin, hasCase); }
  function scrollToSearch() { searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

  return (
    <div>
      {/* ─── HERO (split: text left, image right) ─── */}
      <section className="bg-gradient-to-br from-brand-800 via-brand-900 to-brand-800">
        <div className="max-w-6xl mx-auto px-[var(--spacing-page)] py-14 sm:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            {/* Left — text + search */}
            <div>
              <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-white leading-[1.1] tracking-tight">
                Sell Your Used Media{' '}
                <span className="bg-gradient-to-r from-brand-300 to-brand-200 bg-clip-text text-transparent">For Cash</span>
              </h1>
              <p className="mt-4 text-brand-100 text-lg leading-relaxed max-w-md">
                Books, DVDs, CDs, and video games. Instant offers, free shipping, fast payment.
              </p>

              {/* Search bar */}
              <form ref={searchRef} onSubmit={handleSearch} className="mt-8 relative max-w-lg">
                <label htmlFor="home-search" className="sr-only">Search by ISBN, UPC, or title</label>
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  id="home-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter ISBN (e.g. 9780134580999)"
                  className="w-full pl-12 pr-28 py-3.5 rounded-xl bg-white text-text-primary placeholder:text-text-muted text-base focus:outline-none focus:ring-3 focus:ring-brand-400/40 min-h-[52px] shadow-lg"
                />
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-5 h-10 flex items-center justify-center rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm cursor-pointer"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Get Quote'}
                </button>
              </form>

              {/* Scan button */}
              <button
                onClick={() => { setScannerOpen(true); setResult(null); setSearchQuery(''); }}
                className="mt-4 inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium cursor-pointer min-h-[44px]"
              >
                <Camera size={18} />
                Or scan a barcode with your camera
              </button>
            </div>

            {/* Right — hero image */}
            <div className="hidden md:flex justify-center">
              <img
                src="/images/scan-barcode.png"
                alt="Person scanning a book barcode with their phone"
                className="w-full max-w-sm rounded-2xl shadow-2xl shadow-black/30"
              />
            </div>
          </div>
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
          <div role="alert" className="bg-reject-light border border-reject/20 rounded-xl p-4 text-center mt-6">
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

      {/* ─── SIMPLE 3-STEP PROCESS ─── */}
      <section className="max-w-4xl mx-auto px-[var(--spacing-page)] py-16">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary text-center">
          Simple 3-Step Process
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mt-12">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center text-center group">
              <div className="relative mb-5">
                <img
                  src={step.image}
                  alt={step.title}
                  className="w-48 h-36 object-cover rounded-2xl shadow-lg group-hover:shadow-xl group-hover:scale-[1.03] transition-all"
                />
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center ring-2 ring-background">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-display text-lg font-bold text-text-primary">{step.title}</h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-[240px]">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── WHAT WE BUY ─── */}
      <section className="bg-white border-y border-border/40">
        <div className="max-w-3xl mx-auto px-[var(--spacing-page)] py-14">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary text-center">
            What We Buy
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mt-10">
            {WHAT_WE_BUY.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-3 group cursor-default">
                <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                  <Icon size={28} className="text-brand-600" strokeWidth={1.5} />
                </div>
                <span className="font-display font-semibold text-sm text-text-primary">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW OFFERS WORK (set price expectations) ─── */}
      <section className="bg-brand-50/40 border-y border-brand-100">
        <div className="max-w-4xl mx-auto px-[var(--spacing-page)] py-14">
          <div className="text-center mb-10">
            <p className="text-brand-600 font-semibold text-sm tracking-wide uppercase">Pricing</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary mt-2">
              How Our Offers Work
            </h2>
            <p className="mt-3 text-base text-text-secondary max-w-xl mx-auto leading-relaxed">
              Like Decluttr or SellBackYourBook, our model is volume-based. Most items are worth a few cents each — but a typical box adds up fast, and shipping is always free.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Bulk tier */}
            <div className="bg-white rounded-2xl p-5 border border-border/60 shadow-sm text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-3">
                <span className="text-amber-600 font-display font-bold text-base">10¢</span>
              </div>
              <h3 className="font-display font-bold text-base text-text-primary">Bulk Items</h3>
              <p className="mt-1.5 text-xs text-text-muted font-semibold uppercase tracking-wide">Most items</p>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                Common paperbacks, older DVDs &amp; CDs, slow-moving titles. Pays per item — your 50-item box can still net $5–10 plus a free label.
              </p>
            </div>
            {/* Standard tier */}
            <div className="bg-white rounded-2xl p-5 border border-border/60 shadow-sm text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-100 mb-3">
                <span className="text-brand-700 font-display font-bold text-sm">25¢-$2</span>
              </div>
              <h3 className="font-display font-bold text-base text-text-primary">Decent Items</h3>
              <p className="mt-1.5 text-xs text-text-muted font-semibold uppercase tracking-wide">Some items</p>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                Recent fiction, popular DVDs, in-demand games. Items with steady resale value but not super hot.
              </p>
            </div>
            {/* Hot tier */}
            <div className="bg-white rounded-2xl p-5 border border-border/60 shadow-sm text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accept-light mb-3">
                <span className="text-accept font-display font-bold text-sm">$2-$30+</span>
              </div>
              <h3 className="font-display font-bold text-base text-text-primary">Hot Items</h3>
              <p className="mt-1.5 text-xs text-text-muted font-semibold uppercase tracking-wide">A few items</p>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                Textbooks, modern video games, rare Blu-rays, recent bestsellers. Premium pricing — these pay for the box.
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">Average box pays $5–$25</span> for 50–100 items, with free USPS Media Mail label included.
          </p>
        </div>
      </section>

      {/* ─── CUSTOMER TESTIMONIALS ─── */}
      <section className="bg-background">
        <div className="max-w-4xl mx-auto px-[var(--spacing-page)] py-14">
          <p className="text-brand-600 font-semibold text-sm text-center tracking-wide uppercase">Reviewer Testimonials</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary text-center mt-2">
            Customer Testimonials
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {[
              { name: 'Sarah M.', date: '4 days ago', rating: 5, title: 'Super easy process', text: 'Scanned my textbooks, got instant quotes, shipped for free. Payment hit my PayPal in 2 days. Will definitely use again!' },
              { name: 'James S.', date: '5 days ago', rating: 5, title: 'Best prices I found', text: 'Compared CleanSlate to three other buyback sites. They offered the most for my nursing textbooks. Process was seamless.' },
              { name: 'Maria L.', date: '1 week ago', rating: 5, title: 'Great for bulk selling', text: 'Had about 30 DVDs and old textbooks. The bulk scan feature saved me so much time. Got paid $127 total.' },
              { name: 'Sarah K.', date: '1 week ago', rating: 4, title: 'Fast and reliable', text: 'Shipped my books on Monday, got paid Thursday. Only wish they accepted vinyl records too!' },
              { name: 'James S.', date: '2 weeks ago', rating: 5, title: 'Finally cleaned my shelf', text: 'Had boxes of old textbooks from college. CleanSlate made it so easy to turn them into cash. Free shipping was the cherry on top.' },
              { name: 'Mike A.', date: '2 weeks ago', rating: 5, title: 'Smooth experience', text: 'The barcode scanner worked perfectly on my phone. Added 12 items in under 2 minutes. Highly recommend.' },
            ].map((review, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-border/60 shadow-sm">
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
      <div className="bg-white">
        <FAQ />
      </div>

      {/* ─── FINAL CTA ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900">
        <div className="relative max-w-3xl mx-auto px-[var(--spacing-page)] py-16 text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Ready to Sell?
          </h2>
          <p className="mt-3 text-base text-brand-100">
            Get an instant quote for your items. No obligation, no fees.
          </p>
          <button
            onClick={scrollToSearch}
            className="mt-6 inline-flex items-center gap-2 bg-white hover:bg-brand-50 active:scale-[0.97] text-brand-700 font-bold text-base px-8 py-4 rounded-2xl shadow-xl shadow-black/15 cursor-pointer"
          >
            <ArrowRight size={18} />
            Start Selling
          </button>
        </div>
      </section>

      {scannerOpen && <BarcodeScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />}
    </div>
  );
}

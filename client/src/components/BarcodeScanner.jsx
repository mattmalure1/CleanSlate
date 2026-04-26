import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, ShoppingCart, Trash2, Check, Loader2, Flashlight, FlashlightOff, Info, Layers } from 'lucide-react';
import { apiUrl } from '../api';
import { useCart } from '../context/CartContext';

// localStorage key for the one-time bulk explainer modal
const BULK_EXPLAINER_KEY = 'cleanslate_bulk_explainer_seen';

// Session-level cache — survives component mount/unmount within same page load.
const sessionCache = new Map();

// Target barcode formats for physical media (books, DVDs, CDs, games)
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

export default function BarcodeScanner({ onScan, onClose }) {
  const { addItem } = useCart();
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const lastScanTime = useRef(0);
  const recentScans = useRef(new Set());
  const stopped = useRef(false);

  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState([]);
  const [pendingLookups, setPendingLookups] = useState(new Set());
  const [flash, setFlash] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [showBulkExplainer, setShowBulkExplainer] = useState(false);
  const flashTimer = useRef(null);
  const bulkExplainerShown = useRef(false);

  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  // ── Audio + haptic feedback ──
  function playTone(freq, duration = 0.08) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; g.gain.value = 0.15;
      o.start(); o.stop(ctx.currentTime + duration);
    } catch {}
  }

  function vibrate() {
    try { navigator.vibrate?.(50); } catch {}
  }

  function showFlash(type, text) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash({ type, text, key: Date.now() });
    flashTimer.current = setTimeout(() => setFlash(null), 1800);
  }

  // ── Result handling ──
  function addResult(item) {
    setItems(prev => [item, ...prev]);
    const isPenny = item.status === 'penny';
    const ok = item.status === 'accepted' || item.status === 'low' || isPenny;
    if (ok) {
      const addResultStatus = addItem({
        asin: item.asin, title: item.title, imageUrl: item.imageUrl,
        offerCents: item.offerCents, offerDisplay: item.offerDisplay,
        category: item.category, isDisc: item.isDisc, hasCase: item.hasCase,
        color: item.color, label: item.label,
        tier: isPenny ? 'penny' : 'standard',
      });

      // Cart hit the per-ASIN cap (anti-fraud). Surface a soft warning;
      // don't add. Server enforces the same limit at order time.
      if (addResultStatus && addResultStatus.ok === false) {
        showFlash('reject', addResultStatus.reason || 'Per-item max reached');
        playTone(330, 0.12);
        return;
      }

      if (isPenny) {
        showFlash('penny', `${item.offerDisplay} bulk add — ${item.title || 'Added!'}`);
        playTone(550, 0.10);
        // Show one-time bulk explainer the first time a penny item appears.
        // Persisted in localStorage so it doesn't nag returning customers.
        if (!bulkExplainerShown.current) {
          bulkExplainerShown.current = true;
          try {
            if (!localStorage.getItem(BULK_EXPLAINER_KEY)) {
              setShowBulkExplainer(true);
            }
          } catch { /* localStorage unavailable — skip */ }
        }
      } else {
        showFlash('accept', `${item.offerDisplay} — ${item.title || 'Added!'}`);
        playTone(880, 0.08);
      }
    } else {
      showFlash('reject', item.message || item.reason || 'Pass');
      playTone(330, 0.15);
    }
  }

  // ── Client-side barcode pre-filter ──
  // Skip only the most obvious non-media barcodes. We were too aggressive before
  // and were blocking real DVDs/CDs/games. When in doubt, let it through to Keepa.
  // Per GS1: 030-039 = drugs/health (definitely not media). Everything else
  // can contain media releases, so let Keepa be the judge.
  function isLikelyMedia(code) {
    const c = code.replace(/\D/g, '');
    // ISBN-13 — always media
    if (c.startsWith('978') || c.startsWith('979')) return true;
    // Short codes — could be anything, let through
    if (c.length < 10) return true;
    // Only block the truly obvious non-media: drugs/pharmaceuticals (030-039)
    const p3 = c.slice(0, 3);
    if (p3 >= '030' && p3 <= '039') return false;
    // Everything else — let Keepa decide
    return true;
  }

  // ── Non-blocking API lookup with session cache ──
  function lookupCode(code) {
    // Instant skip for obvious non-media barcodes (grocery, health, household)
    if (!isLikelyMedia(code)) {
      addResult({
        id: crypto.randomUUID(), code,
        title: 'Not a media item',
        status: 'rejected',
        offerDisplay: '$0.00',
        offerCents: 0,
        message: 'We only buy books, DVDs, CDs, and video games.',
      });
      return;
    }

    if (sessionCache.has(code)) {
      addResult({ id: crypto.randomUUID(), code, ...sessionCache.get(code) });
      return;
    }
    setPendingLookups(prev => new Set(prev).add(code));
    fetch(apiUrl(`/api/quote?code=${encodeURIComponent(code)}&hasCase=true`))
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          addResult({
            id: crypto.randomUUID(),
            code,
            title: 'Not in our catalog',
            status: 'rejected',
            offerDisplay: '$0.00',
            offerCents: 0,
            message: "We couldn't find this item — try another barcode.",
          });
        } else {
          sessionCache.set(code, data);
          addResult({ id: crypto.randomUUID(), code, ...data });
        }
      })
      .catch(() => {
        addResult({
          id: crypto.randomUUID(),
          code,
          title: 'Lookup failed',
          status: 'rejected',
          offerDisplay: '$0.00',
          offerCents: 0,
          message: 'Network issue — please try again.',
        });
      })
      .finally(() => {
        setPendingLookups(prev => { const n = new Set(prev); n.delete(code); return n; });
      });
  }

  // ── Barcode detected callback ──
  // Two layers of dedup:
  //   1. Short-window dedup (4s) on the normalized code — catches cases
  //      where the detector reads the same physical barcode multiple
  //      times in succession (camera lingering on it).
  //   2. Per-scan-session "already in results" check — if we've already
  //      successfully looked up this barcode in this scanner session,
  //      don't re-trigger a network call.
  // Normalization strips leading zeros and non-digits so UPC-A
  // (12 digits, "786936...") and EAN-13 (13 digits, "0786936...")
  // representations of the same product get treated as identical.
  function normalizeBarcode(code) {
    if (!code) return '';
    return String(code).replace(/\D/g, '').replace(/^0+/, '');
  }

  const onBarcode = useCallback((rawValue) => {
    if (!rawValue) return;
    const normalized = normalizeBarcode(rawValue);
    if (!normalized) return;

    // Check if already in this session's results — prevent re-lookup of
    // an item the user has already added or seen rejected.
    if (recentScans.current.has(normalized)) return;

    // 4-second cooldown on the normalized code (was 1.5s — too short
    // for users who linger or for cases where the detector flickers
    // between UPC-A and EAN-13 representations).
    recentScans.current.add(normalized);
    setTimeout(() => recentScans.current.delete(normalized), 4000);

    // Haptic + scan beep
    vibrate();
    playTone(660, 0.05);

    lookupCode(rawValue);
    onScanRef.current?.(rawValue);
  }, []);

  // ── Torch toggle ──
  function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track) return;
    const next = !torchOn;
    track.applyConstraints({ advanced: [{ torch: next }] }).then(() => setTorchOn(next)).catch(() => {});
  }

  // ── Camera + detector init ──
  useEffect(() => {
    let animating = true;

    async function init() {
      try {
        // 1. Open camera at 1080p with continuous autofocus
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
            advanced: [{ focusMode: 'continuous' }],
          },
          audio: false,
        });

        if (stopped.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // Check torch capability
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() || {};
        if (caps.torch) setHasTorch(true);

        // Attach to video element
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // 2. Create barcode detector (native or polyfill)
        let detector;
        if ('BarcodeDetector' in window) {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          const formats = BARCODE_FORMATS.filter(f => supported.includes(f));
          detector = new window.BarcodeDetector({ formats: formats.length > 0 ? formats : undefined });
        } else {
          // Polyfill fallback (barcode-detector package provides this)
          const { BarcodeDetector } = await import('barcode-detector');
          detector = new BarcodeDetector({ formats: BARCODE_FORMATS });
        }
        detectorRef.current = detector;

        setReady(true);

        // 3. Detection loop — throttled to ~10fps (100ms gap)
        const MIN_INTERVAL = 100;

        async function detectFrame() {
          if (!animating || stopped.current) return;

          const now = performance.now();
          if (now - lastScanTime.current >= MIN_INTERVAL && video.readyState >= 2) {
            lastScanTime.current = now;
            try {
              const barcodes = await detector.detect(video);
              for (const barcode of barcodes) {
                onBarcode(barcode.rawValue);
              }
            } catch {}
          }
          rafRef.current = requestAnimationFrame(detectFrame);
        }

        rafRef.current = requestAnimationFrame(detectFrame);

      } catch (err) {
        if (stopped.current) return;
        const msg = String(err);
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setError('Camera access denied. Allow camera in browser settings.');
        } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
          setError('No camera found on this device.');
        } else {
          setError('Could not start camera. Try refreshing.');
          console.error('Scanner init error:', err);
        }
      }
    }

    init();

    return () => {
      animating = false;
      stopped.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [onBarcode]);

  // ── Close handler ──
  function handleClose() {
    if (pendingLookups.size > 0) {
      if (!window.confirm(`${pendingLookups.size} lookup(s) still in progress. Close anyway?`)) return;
    }
    stopped.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    onCloseRef.current();
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function dismissBulkExplainer() {
    setShowBulkExplainer(false);
    try { localStorage.setItem(BULK_EXPLAINER_KEY, '1'); } catch { /* ignore */ }
  }

  const isOffer = (i) => i.status === 'accepted' || i.status === 'low' || i.status === 'penny';
  const acceptedCount = items.filter(isOffer).length;
  const totalCents = items.filter(isOffer).reduce((s, i) => s + (i.offerCents || 0), 0);

  return (
    <div role="dialog" aria-modal="true" aria-label="Barcode scanner" className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <button onClick={handleClose} className="text-white min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer">
          <X size={24} />
        </button>
        <span className="text-white font-semibold text-sm">
          {items.length > 0 ? `${items.length} scanned` : 'Scan barcodes'}
        </span>
        <div className="flex items-center gap-2">
          {hasTorch && (
            <button onClick={toggleTorch} className="text-white min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer">
              {torchOn ? <FlashlightOff size={20} /> : <Flashlight size={20} />}
            </button>
          )}
          {acceptedCount > 0 ? (
            <span className="bg-brand-500 text-white text-sm font-bold px-4 py-2 rounded-full flex items-center gap-1.5">
              <ShoppingCart size={16} />
              {acceptedCount} · ${(totalCents / 100).toFixed(2)}
            </span>
          ) : <div className="w-[44px]" />}
        </div>
      </div>

      {/* Camera — always full height */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Loading state */}
        {!error && !ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black z-20">
            <Camera size={40} className="animate-pulse" />
            <p className="text-sm">Starting camera...</p>
          </div>
        )}

        {/* Scan region overlay — centered target box */}
        {ready && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-[280px] h-[160px] sm:w-[400px] sm:h-[200px] border-2 border-brand-400/60 rounded-xl relative">
              {/* Corner accents */}
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-3 border-l-3 border-brand-400 rounded-tl-lg" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-3 border-r-3 border-brand-400 rounded-tr-lg" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-3 border-l-3 border-brand-400 rounded-bl-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-3 border-r-3 border-brand-400 rounded-br-lg" />
              {/* Scan line */}
              <div className="absolute top-1/2 left-2 right-2 h-[2px] bg-brand-400/50 animate-pulse" />
            </div>
          </div>
        )}

        {/* Pending lookup indicator */}
        {pendingLookups.size > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-brand-600 text-white text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
            <Loader2 size={14} className="animate-spin" />
            Looking up {pendingLookups.size === 1 ? [...pendingLookups][0] : `${pendingLookups.size} items`}...
          </div>
        )}

        {/* Flash indicator */}
        {flash && (
          <div
            key={flash.key}
            className={`absolute inset-x-4 top-14 z-30 rounded-xl px-5 py-3 flex items-center gap-3 shadow-2xl animate-[fadeInOut_1.8s_ease-in-out_forwards] ${
              flash.type === 'accept'
                ? 'bg-green-500/90 border-2 border-green-300'
                : flash.type === 'penny'
                  ? 'bg-amber-500/90 border-2 border-amber-300'
                  : 'bg-red-500/90 border-2 border-red-300'
            }`}
          >
            {flash.type === 'reject'
              ? <X size={22} className="text-white flex-shrink-0" />
              : <Check size={22} className="text-white flex-shrink-0" />
            }
            <span className="text-white text-sm font-semibold truncate">{flash.text}</span>
          </div>
        )}

        {/* Results overlay */}
        {items.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/90 max-h-[30vh] overflow-y-auto border-t border-white/10">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-brand-900/95 border-b border-white/10">
              <span className="text-white/70 text-xs">{acceptedCount} item{acceptedCount !== 1 ? 's' : ''} accepted</span>
              <span className="text-brand-400 font-bold text-sm">${(totalCents / 100).toFixed(2)}</span>
            </div>
            {items.map((item, i) => {
              const isPenny = item.status === 'penny';
              const ok = item.status === 'accepted' || item.status === 'low' || isPenny;
              return (
                <div key={`${item.code}-${i}`} className="flex items-center gap-3 px-4 py-2 border-b border-white/5">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-9 h-9 rounded flex items-center justify-center flex-shrink-0 ${
                      ok ? (isPenny ? 'bg-amber-900/50' : 'bg-brand-900') : 'bg-red-900/50'
                    }`}>
                      {ok ? <Check size={14} className={isPenny ? 'text-amber-400' : 'text-brand-400'} /> : <X size={14} className="text-red-400" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs truncate">{item.title || item.code}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ok ? (
                      <span className={`font-bold text-xs ${isPenny ? 'text-amber-400' : 'text-brand-400'}`}>{item.offerDisplay}</span>
                    ) : (
                      <span className="text-red-400 text-xs">Pass</span>
                    )}
                    <button onClick={() => removeItem(item.id)} className="text-white/30 hover:text-red-400 p-1 cursor-pointer">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom instruction */}
        {items.length === 0 && !error && ready && (
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/70 text-center py-3 px-6">
            <p className="text-white text-sm font-medium">Point camera at any barcode</p>
            <p className="text-white/40 text-xs mt-0.5">ISBN, UPC, or EAN — works from 6-18 inches</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-black/90 text-center py-4 px-6">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={handleClose} className="text-white text-sm underline mt-2 min-h-[44px] cursor-pointer">Go back</button>
        </div>
      )}

      {/* One-time bulk explainer — fires the first time a penny item is added */}
      {showBulkExplainer && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={dismissBulkExplainer}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Layers size={22} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-lg text-text-primary">Bulk items pay 10¢ each</h3>
                <p className="text-xs text-text-muted mt-0.5">Most media is bulk-tier — they add up fast.</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
              <div className="flex gap-2.5">
                <Info size={16} className="text-brand-600 flex-shrink-0 mt-0.5" />
                <p>Common books, older DVDs, and CDs go to our eBay bulk lots. <span className="font-semibold text-text-primary">10¢ per item</span> — typical box of 50 items pays $5+.</p>
              </div>
              <div className="flex gap-2.5">
                <Info size={16} className="text-brand-600 flex-shrink-0 mt-0.5" />
                <p>Hot items (textbooks, recent games, popular Blu-rays) pay <span className="font-semibold text-text-primary">$1–$30+</span> when they show up.</p>
              </div>
              <div className="flex gap-2.5">
                <Info size={16} className="text-brand-600 flex-shrink-0 mt-0.5" />
                <p>Free USPS shipping label included with every order. Just keep scanning — your total adds up.</p>
              </div>
            </div>

            <button
              onClick={dismissBulkExplainer}
              className="mt-5 w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold text-base py-3.5 rounded-xl min-h-[48px] cursor-pointer"
            >
              Got it, keep scanning
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

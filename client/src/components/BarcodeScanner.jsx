import { useEffect, useRef, useState } from 'react';
import { X, Camera, ShoppingCart, Trash2, Check, Loader2 } from 'lucide-react';
import { apiUrl } from '../api';
import { useCart } from '../context/CartContext';

// Session-level cache: avoids re-fetching the same barcode within one browser session.
// Survives component mount/unmount cycles (e.g. close scanner, re-open).
const sessionCache = new Map();

export default function BarcodeScanner({ onScan, onClose, rapid = false }) {
  const { addItem } = useCart();
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState([]);
  const [pendingLookups, setPendingLookups] = useState(new Set());
  const recentScans = useRef(new Set());
  const stopped = useRef(false);

  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  function addResult(item) {
    setItems(prev => [item, ...prev]);
    if (item.status === 'accepted' || item.status === 'low') {
      addItem({
        asin: item.asin,
        title: item.title,
        imageUrl: item.imageUrl,
        offerCents: item.offerCents,
        offerDisplay: item.offerDisplay,
        category: item.category,
        isDisc: item.isDisc,
        hasCase: item.hasCase,
        color: item.color,
        label: item.label,
      });
    }
  }

  // Non-blocking lookup — scanner keeps running while this executes.
  // Uses session cache for instant re-scans.
  function lookupCode(code) {
    // Session cache hit → instant, no API call
    if (sessionCache.has(code)) {
      const cached = sessionCache.get(code);
      addResult({ id: crypto.randomUUID(), code, ...cached });
      return;
    }

    // Track this code as pending (non-blocking indicator)
    setPendingLookups(prev => new Set(prev).add(code));

    fetch(apiUrl(`/api/quote?code=${encodeURIComponent(code)}&hasCase=true`))
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          addResult({ id: crypto.randomUUID(), code, title: 'Not found', status: 'rejected', offerDisplay: '$0.00', offerCents: 0 });
        } else {
          sessionCache.set(code, data);
          addResult({ id: crypto.randomUUID(), code, ...data });
        }
      })
      .catch(() => {
        addResult({ id: crypto.randomUUID(), code, title: 'Lookup failed', status: 'rejected', offerDisplay: '$0.00', offerCents: 0 });
      })
      .finally(() => {
        setPendingLookups(prev => {
          const next = new Set(prev);
          next.delete(code);
          return next;
        });
      });
  }

  useEffect(() => {
    let scanner = null;

    async function init() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        await new Promise(r => setTimeout(r, 200));
        if (stopped.current) return;

        scanner = new Html5Qrcode('scanner-region');
        scannerRef.current = scanner;

        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setError('No camera found.');
          return;
        }

        const backCam = devices.find(d =>
          /back|rear|environment/i.test(d.label)
        );
        const cameraId = backCam ? backCam.id : devices[devices.length - 1].id;

        // Scan region uses a percentage of the video feed — much wider than
        // the old fixed 500×200px box. This lets barcodes be read from further
        // away because more of the camera frame is analyzed. fps bumped from
        // 15 → 20 for faster detection cycles.
        const qrboxFunction = (viewfinderWidth, viewfinderHeight) => ({
          width: Math.floor(viewfinderWidth * 0.85),
          height: Math.floor(viewfinderHeight * 0.40),
        });

        await scanner.start(
          { deviceId: { exact: cameraId } },
          {
            fps: 20,
            qrbox: qrboxFunction,
            videoConstraints: {
              deviceId: { exact: cameraId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              focusMode: 'continuous',
            },
          },
          (text) => {
            if (recentScans.current.has(text)) return;
            recentScans.current.add(text);
            setTimeout(() => recentScans.current.delete(text), 4000);

            // Beep
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const o = ctx.createOscillator();
              const g = ctx.createGain();
              o.connect(g); g.connect(ctx.destination);
              o.frequency.value = 880; g.gain.value = 0.15;
              o.start(); o.stop(ctx.currentTime + 0.08);
            } catch {}

            // Always lookup (rapid behavior built-in)
            lookupCode(text);
            onScanRef.current(text);
          },
          () => {}
        );

        setReady(true);
      } catch (err) {
        if (stopped.current) return;
        if (String(err).includes('Permission') || String(err).includes('NotAllowed')) {
          setError('Camera access denied. Allow camera in browser settings.');
        } else {
          setError('Could not start camera.');
          console.error(err);
        }
      }
    }

    init();

    return () => {
      stopped.current = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  function handleClose() {
    if (pendingLookups.size > 0) {
      if (!window.confirm(`${pendingLookups.size} lookup(s) still in progress. Close anyway?`)) return;
    }

    stopped.current = true;
    const doClose = () => onCloseRef.current();
    if (scannerRef.current) {
      scannerRef.current.stop().then(doClose).catch(doClose);
      scannerRef.current = null;
    } else {
      doClose();
    }
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const acceptedCount = items.filter(i => i.status === 'accepted' || i.status === 'low').length;
  const totalCents = items.filter(i => i.status === 'accepted' || i.status === 'low').reduce((s, i) => s + (i.offerCents || 0), 0);

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
        {acceptedCount > 0 ? (
          <span className="bg-brand-500 text-white text-sm font-bold px-4 py-2 rounded-full flex items-center gap-1.5">
            <ShoppingCart size={16} />
            {acceptedCount} in cart · ${(totalCents / 100).toFixed(2)}
          </span>
        ) : <div className="w-[44px]" />}
      </div>

      {/* Camera */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <div id="scanner-region" className="w-full h-full" />

        {!error && !ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black z-20">
            <Camera size={40} className="animate-pulse" />
            <p className="text-sm">Starting camera...</p>
          </div>
        )}

        {/* Barcode-shaped scan guide overlay */}
        {ready && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="relative">
              {/* Barcode lines illustration */}
              <div className="flex items-end gap-[2px] opacity-30">
                {[20,28,14,24,18,30,12,26,16,28,22,14,30,18,24,12,28,20,26,14,22,30,16,28,18,24,20,12,26,22].map((h, i) => (
                  <div key={i} className="w-[3px] bg-white rounded-sm" style={{ height: h }} />
                ))}
              </div>
              {/* Scan line animation */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-brand-400 animate-pulse" />
            </div>
          </div>
        )}

        {/* Non-blocking lookup indicator — scanner keeps running */}
        {pendingLookups.size > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-brand-600 text-white text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
            <Loader2 size={14} className="animate-spin" />
            Looking up {pendingLookups.size === 1 ? [...pendingLookups][0] : `${pendingLookups.size} items`}...
          </div>
        )}
      </div>

      {/* Results list (bottom overlay) */}
      {items.length > 0 && (
        <div className="bg-black/95 max-h-[35vh] overflow-y-auto border-t border-white/10">
          {items.map((item, i) => {
            const ok = item.status === 'accepted' || item.status === 'low';
            return (
              <div key={`${item.code}-${i}`} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${ok ? 'bg-brand-900' : 'bg-red-900/50'}`}>
                    {ok ? <Check size={16} className="text-brand-400" /> : <X size={16} className="text-red-400" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{item.title || item.code}</p>
                  {item.category && <p className="text-white/40 text-xs capitalize">{item.category}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ok ? (
                    <span className="text-brand-400 font-bold text-sm">{item.offerDisplay} <Check size={12} className="inline" /></span>
                  ) : (
                    <span className="text-red-400 text-xs font-semibold">Pass</span>
                  )}
                  <button onClick={() => removeItem(item.id)} className="text-white/30 hover:text-red-400 min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom instruction */}
      {items.length === 0 && !error && (
        <div className="bg-black/90 text-center py-4 px-6">
          <p className="text-white text-sm font-medium">Point camera at any barcode</p>
          <p className="text-white/40 text-xs mt-1">ISBN, UPC, or EAN — any orientation</p>
        </div>
      )}

      {error && (
        <div className="bg-black/90 text-center py-4 px-6">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={handleClose} className="text-white text-sm underline mt-2 min-h-[44px] cursor-pointer">Go back</button>
        </div>
      )}
    </div>
  );
}

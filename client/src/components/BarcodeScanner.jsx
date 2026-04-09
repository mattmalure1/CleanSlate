import { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';

export default function BarcodeScanner({ onScan, onClose, rapid = false }) {
  const scannerRef = useRef(null);
  const html5ScannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const recentScans = useRef(new Set());
  const stoppingRef = useRef(false);

  // Keep onScan ref current without triggering re-renders
  onScanRef.current = onScan;

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;

        // Wait a tick for the DOM element to be ready
        await new Promise(r => setTimeout(r, 100));
        if (!mounted || !document.getElementById('barcode-scanner-viewport')) return;

        const scanner = new Html5Qrcode('barcode-scanner-viewport', { verbose: false });
        html5ScannerRef.current = scanner;

        function onSuccess(decodedText) {
          // Dedupe within 3 seconds
          if (recentScans.current.has(decodedText)) return;
          recentScans.current.add(decodedText);
          setTimeout(() => recentScans.current.delete(decodedText), 3000);

          setLastScanned(decodedText);
          setScanCount(prev => prev + 1);

          // Beep
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.1;
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
          } catch {}

          if (rapid) {
            onScanRef.current(decodedText);
          } else {
            // Single mode: stop first, then callback
            if (!stoppingRef.current) {
              stoppingRef.current = true;
              scanner.stop().then(() => {
                onScanRef.current(decodedText);
              }).catch(() => {
                onScanRef.current(decodedText);
              });
            }
          }
        }

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 140 },
            disableFlip: false,
          },
          onSuccess,
          () => {} // ignore failures between frames
        );

        if (mounted) setReady(true);
      } catch (err) {
        if (!mounted) return;
        if (err?.name === 'NotAllowedError' || String(err).includes('Permission')) {
          setError('Camera access was denied. Please allow camera access in your browser settings.');
        } else {
          setError('Could not start the camera. Try searching by title instead.');
          console.error('Scanner error:', err);
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (html5ScannerRef.current) {
        html5ScannerRef.current.stop().catch(() => {});
        html5ScannerRef.current = null;
      }
    };
  }, []); // No dependencies — start once, never restart

  function handleClose() {
    if (html5ScannerRef.current && !stoppingRef.current) {
      stoppingRef.current = true;
      html5ScannerRef.current.stop().catch(() => {});
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 bg-black/60 text-white rounded-full p-2.5 min-w-[48px] min-h-[48px] flex items-center justify-center backdrop-blur-md cursor-pointer"
        aria-label="Close scanner"
      >
        <X size={24} />
      </button>

      {rapid && scanCount > 0 && (
        <div className="absolute top-4 left-4 z-10 bg-brand-600 text-white rounded-full px-4 py-2 text-sm font-bold backdrop-blur-md">
          {scanCount} scanned
        </div>
      )}

      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
        <div id="barcode-scanner-viewport" className="w-full h-full" ref={scannerRef} />

        {!error && !ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black">
            <Camera size={40} className="animate-pulse" />
            <p className="text-sm">Starting camera...</p>
          </div>
        )}
      </div>

      <div className="bg-black/90 backdrop-blur-md text-center py-4 px-6">
        {error ? (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={handleClose} className="text-white text-sm underline min-h-[44px] cursor-pointer">
              Go back to search
            </button>
          </div>
        ) : (
          <div>
            <p className="text-white/90 text-sm font-medium">
              {rapid ? 'Rapid Scan — point at barcodes continuously' : 'Point camera at barcode'}
            </p>
            {rapid && lastScanned && (
              <p className="text-brand-400 text-xs mt-1">Last: {lastScanned}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

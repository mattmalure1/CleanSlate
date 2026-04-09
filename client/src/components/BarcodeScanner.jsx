import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, Volume2 } from 'lucide-react';

// html5-qrcode handles upside-down, rotated, and angled barcodes natively
// It uses ZXing under the hood which supports all orientations

export default function BarcodeScanner({ onScan, onClose, rapid = false }) {
  const scannerRef = useRef(null);
  const html5ScannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const recentScans = useRef(new Set());

  const handleScanSuccess = useCallback((decodedText) => {
    // Dedupe: don't fire the same code twice within 3 seconds
    if (recentScans.current.has(decodedText)) return;
    recentScans.current.add(decodedText);
    setTimeout(() => recentScans.current.delete(decodedText), 3000);

    setLastScanned(decodedText);
    setScanCount(prev => prev + 1);

    // Play a subtle beep for feedback
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
      // In rapid mode, fire the callback but keep scanning
      onScan(decodedText);
    } else {
      // Single mode: stop scanner and return
      if (html5ScannerRef.current) {
        html5ScannerRef.current.stop().catch(() => {});
      }
      onScan(decodedText);
    }
  }, [onScan, rapid]);

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        if (!mounted || !scannerRef.current) return;

        const scanner = new Html5Qrcode('barcode-scanner-viewport', {
          verbose: false,
        });
        html5ScannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 280, height: 140 },
            aspectRatio: 16 / 9,
            disableFlip: false, // KEY: enables upside-down barcode reading
          },
          handleScanSuccess,
          () => {} // ignore scan failures (normal between frames)
        );

        if (mounted) setReady(true);
      } catch (err) {
        if (!mounted) return;
        if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
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
      }
    };
  }, [handleScanSuccess]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Close button */}
      <button
        onClick={() => {
          if (html5ScannerRef.current) html5ScannerRef.current.stop().catch(() => {});
          onClose();
        }}
        className="absolute top-4 right-4 z-10 bg-black/60 text-white rounded-full p-2.5 min-w-[48px] min-h-[48px] flex items-center justify-center backdrop-blur-md cursor-pointer"
        aria-label="Close scanner"
      >
        <X size={24} />
      </button>

      {/* Rapid mode scan counter */}
      {rapid && scanCount > 0 && (
        <div className="absolute top-4 left-4 z-10 bg-brand-600 text-white rounded-full px-4 py-2 text-sm font-bold backdrop-blur-md">
          {scanCount} scanned
        </div>
      )}

      {/* Camera viewport */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
        <div id="barcode-scanner-viewport" ref={scannerRef} className="w-full h-full" />

        {!error && !ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black">
            <Camera size={40} className="animate-pulse" />
            <p className="text-sm">Starting camera...</p>
          </div>
        )}
      </div>

      {/* Instruction bar */}
      <div className="bg-black/90 backdrop-blur-md text-center py-4 px-6 safe-area-bottom">
        {error ? (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={onClose} className="text-white text-sm underline min-h-[44px] cursor-pointer">
              Go back to search
            </button>
          </div>
        ) : (
          <div>
            <p className="text-white/90 text-sm font-medium">
              {rapid ? 'Rapid Scan Mode — point at barcodes continuously' : 'Point camera at barcode'}
            </p>
            {rapid && lastScanned && (
              <p className="text-brand-400 text-xs mt-1">
                Last: {lastScanned}
              </p>
            )}
            <p className="text-white/50 text-xs mt-1">
              Works with upside-down and angled barcodes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

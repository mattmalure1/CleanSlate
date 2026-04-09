import { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';

export default function BarcodeScanner({ onScan, onClose, rapid = false }) {
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const recentScans = useRef(new Set());
  const stopped = useRef(false);

  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  useEffect(() => {
    let scanner = null;

    async function init() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        // Wait for DOM
        await new Promise(r => setTimeout(r, 200));
        if (stopped.current) return;

        scanner = new Html5Qrcode('scanner-region');
        scannerRef.current = scanner;

        // Get camera device ID — prefer back camera
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setError('No camera found on this device.');
          return;
        }

        // Pick back camera if available
        const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
        const cameraId = backCam ? backCam.id : devices[devices.length - 1].id;

        await scanner.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 120 },
          },
          (text) => {
            if (recentScans.current.has(text)) return;
            recentScans.current.add(text);
            setTimeout(() => recentScans.current.delete(text), 3000);

            setLastScanned(text);
            setScanCount(p => p + 1);

            // Beep
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const o = ctx.createOscillator();
              const g = ctx.createGain();
              o.connect(g); g.connect(ctx.destination);
              o.frequency.value = 880; g.gain.value = 0.1;
              o.start(); o.stop(ctx.currentTime + 0.1);
            } catch {}

            if (rapid) {
              onScanRef.current(text);
            } else {
              // Stop scanner, wait, then callback
              stopped.current = true;
              scanner.stop().then(() => {
                scannerRef.current = null;
                onScanRef.current(text);
              }).catch(() => {
                scannerRef.current = null;
                onScanRef.current(text);
              });
            }
          },
          () => {} // ignore per-frame failures
        );

        setReady(true);
      } catch (err) {
        if (stopped.current) return;
        const msg = String(err?.message || err);
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setError('Camera access denied. Please allow camera access in your browser settings and try again.');
        } else {
          setError('Could not start camera. Please use the search box instead.');
          console.error('Scanner init error:', err);
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
  }, [rapid]);

  function handleClose() {
    stopped.current = true;
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null;
        onCloseRef.current();
      }).catch(() => {
        scannerRef.current = null;
        onCloseRef.current();
      });
    } else {
      onCloseRef.current();
    }
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
        <div className="absolute top-4 left-4 z-10 bg-brand-600 text-white rounded-full px-4 py-2 text-sm font-bold">
          {scanCount} scanned
        </div>
      )}

      <div className="flex-1 relative overflow-hidden bg-black">
        <div id="scanner-region" className="w-full h-full" />

        {!error && !ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black z-20">
            <Camera size={40} className="animate-pulse" />
            <p className="text-sm">Starting camera...</p>
            <p className="text-xs text-white/50">Allow camera access when prompted</p>
          </div>
        )}
      </div>

      <div className="bg-black/90 text-center py-4 px-6">
        {error ? (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={handleClose} className="text-white text-sm underline min-h-[44px] cursor-pointer">
              Go back
            </button>
          </div>
        ) : (
          <div>
            <p className="text-white text-sm font-medium">
              {rapid ? 'Rapid Scan — keep pointing at barcodes' : 'Point camera at barcode'}
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

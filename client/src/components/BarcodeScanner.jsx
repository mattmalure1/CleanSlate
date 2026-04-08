import { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [quaggaLoaded, setQuaggaLoaded] = useState(false);

  useEffect(() => {
    let Quagga = null;
    let stopped = false;

    async function startScanner() {
      try {
        const quaggaModule = await import('@ericblade/quagga2');
        Quagga = quaggaModule.default || quaggaModule;

        if (stopped) return;

        await new Promise((resolve, reject) => {
          Quagga.init(
            {
              inputStream: {
                name: 'Live',
                type: 'LiveStream',
                target: videoRef.current,
                constraints: {
                  facingMode: 'environment',
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              },
              decoder: {
                readers: [
                  'ean_reader',
                  'ean_8_reader',
                  'upc_reader',
                  'upc_e_reader',
                  'code_128_reader',
                ],
              },
              locate: true,
              frequency: 10,
            },
            (err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            }
          );
        });

        if (stopped) {
          Quagga.stop();
          return;
        }

        setQuaggaLoaded(true);
        Quagga.start();

        Quagga.onDetected((result) => {
          if (result?.codeResult?.code) {
            Quagga.stop();
            onScan(result.codeResult.code);
          }
        });
      } catch (err) {
        if (!stopped) {
          if (err.name === 'NotAllowedError') {
            setError('Camera access was denied. Please allow camera access to scan barcodes.');
          } else {
            setError('Could not start the camera. Please try searching by title instead.');
          }
        }
      }
    }

    startScanner();

    return () => {
      stopped = true;
      if (Quagga) {
        try {
          Quagga.stop();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 bg-black/50 text-white rounded-full p-2 min-w-[44px] min-h-[44px] flex items-center justify-center backdrop-blur-sm"
        aria-label="Close scanner"
      >
        <X size={24} />
      </button>

      {/* Camera viewport */}
      <div ref={videoRef} className="flex-1 relative overflow-hidden">
        {!error && !quaggaLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
            <Camera size={40} className="animate-pulse" />
            <p className="text-sm">Starting camera...</p>
          </div>
        )}

        {/* Scan overlay guide */}
        {quaggaLoaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-36 border-2 border-white/70 rounded-xl relative">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-brand-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-brand-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-brand-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-brand-400 rounded-br-lg" />
            </div>
          </div>
        )}
      </div>

      {/* Instruction bar */}
      <div className="bg-black/80 backdrop-blur-sm text-center py-4 px-6">
        {error ? (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={onClose}
              className="text-white text-sm underline min-h-[44px]"
            >
              Go back to search
            </button>
          </div>
        ) : (
          <p className="text-white/90 text-sm font-medium">
            Point camera at barcode
          </p>
        )}
      </div>
    </div>
  );
}

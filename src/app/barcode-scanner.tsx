import React, { useEffect, useRef } from 'react';
import Quagga from '@ericblade/quagga2';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  isCameraActive: boolean;
}

const BarcodeScannerComponent: React.FC<BarcodeScannerProps> = ({ onDetected, isCameraActive }) => {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCameraActive || !videoRef.current) return;

    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: videoRef.current,
        constraints: {
          facingMode: 'environment', // usa a câmera traseira
        },
      },
      decoder: {
        readers: ['ean_reader', 'ean_13_reader', 'code_128_reader'], // suporta múltiplos formatos
      },
      locate: true,
    }, (err) => {
      if (err) {
        console.error('Erro ao inicializar Quagga:', err);
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected((data) => {
      const code = data.codeResult.code;
      if (code) {
        onDetected(code);
        Quagga.stop(); // parar após leitura (podes tirar isso se quiser ler vários)
      }
    });

    return () => {
      Quagga.stop();
    };
  }, [isCameraActive, onDetected]);

  return (
    <div>
      <div ref={videoRef} style={{ width: '100%', height: 'auto' }} />
      {!isCameraActive && <p>Ative a câmera para iniciar a leitura.</p>}
    </div>
  );
};

export default BarcodeScannerComponent;

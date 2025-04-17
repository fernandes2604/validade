import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { exportToExcel } from '@/lib/excel';

export default function Home() {
  const videoRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '', expiry: new Date() });
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setPermissionGranted(true);
      } catch (error) {
        console.error('Erro ao acessar a câmera:', error);
        setPermissionGranted(false);
      }
    }
    initCamera();
  }, []);

  async function captureAndDecode() {
    const video = videoRef.current;
    if (video) {
      const codeReader = new BrowserMultiFormatReader();
      try {
        const result = await codeReader.decodeOnceFromVideoDevice(undefined, video);
        if (result?.text) {
          setNewProduct(prev => ({ ...prev, barcode: result.text }));
        } else {
          alert('Nenhum código detectado.');
        }
      } catch (error) {
        console.error('Erro ao decodificar:', error);
        alert('Falha ao escanear o código.');
      } finally {
        codeReader.reset();
      }
    }
  }

  function addProduct() {
    if (newProduct.name && newProduct.barcode && newProduct.expiry) {
      setProducts([...products, newProduct]);
      setNewProduct({ name: '', barcode: '', expiry: new Date() });
    } else {
      alert('Preencha todos os campos.');
    }
  }

  function handleShare() {
    const text = products.map(p => `Produto: ${p.name}, Código: ${p.barcode}, Validade: ${format(p.expiry, 'dd/MM/yyyy')}`).join('\n');
    if (navigator.share) {
      navigator.share({ title: 'Lista de Produtos', text });
    } else {
      alert('Compartilhamento não suportado neste navegador.');
    }
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center">Cadastro de Produtos com Validade</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block font-medium">Nome do Produto</label>
          <Input
            value={newProduct.name}
            onChange={e => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Leite UHT"
          />

          <label className="block font-medium">Código de Barras</label>
          <div className="flex gap-2 items-center">
            <Input
              value={newProduct.barcode}
              onChange={e => setNewProduct(prev => ({ ...prev, barcode: e.target.value }))}
              placeholder="Escaneie ou digite o código"
            />
            <Button onClick={captureAndDecode}>Escanear</Button>
          </div>

          <label className="block font-medium">Validade</label>
          <Calendar
            mode="single"
            selected={newProduct.expiry}
            onSelect={date => setNewProduct(prev => ({ ...prev, expiry: date }))}
          />

          <Button className="mt-4 w-full" onClick={addProduct}>Adicionar Produto</Button>
        </div>

        <div>
          <video ref={videoRef} className="w-full rounded-lg shadow" autoPlay playsInline muted />
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">Produtos Cadastrados</h2>
        {products.length === 0 ? (
          <p className="text-gray-500">Nenhum produto adicionado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {products.map((product, index) => (
              <li key={index} className="border p-3 rounded-lg shadow-sm">
                <p><strong>Nome:</strong> {product.name}</p>
                <p><strong>Código:</strong> {product.barcode}</p>
                <p><strong>Validade:</strong> {format(product.expiry, 'dd/MM/yyyy')}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-4 mt-6 justify-center">
        <Button onClick={() => exportToExcel(products)}>Exportar para Excel</Button>
        <Button onClick={handleShare} variant="outline">
          <Share2 className="w-4 h-4 mr-2" /> Compartilhar
        </Button>
      </div>
    </div>
  );
}

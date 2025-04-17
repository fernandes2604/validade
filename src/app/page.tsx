'use client';

import React, {useState, useEffect, useRef} from 'react';
import {useRouter} from 'next/navigation';
import {generateProductName} from '@/ai/flows/generate-product-name';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Calendar} from '@/components/ui/calendar';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {format} from 'date-fns';
import {useToast} from '@/hooks/use-toast';
import {Textarea} from '@/components/ui/textarea';
import {Icons} from '@/components/icons';
import * as XLSXTYPE from 'xlsx';
import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger} from "@/components/ui/alert-dialog";
import {ThemeToggle} from "@/components/theme-toggle" // Certifique-se de que o caminho está correto
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import dynamic from 'next/dynamic';

const BarcodeScannerComponent = dynamic(() => import('./barcode-scanner'), {
  ssr: false,
});

interface Product {
  eanCode: string;
  productName: string;
  expirationDate: Date | null;
  quantity: number;
}

const isValidEan = (ean: string): boolean => {
  if (!/^\d+$/.test(ean)) return false;
  if (ean.length !== 13) return false;

  let sum = 0;
  for (let i = 12; i >= 0; i--) {
    const digit = parseInt(ean[i], 10);
    if (i % 2 === 0) {
      sum += digit;
    } else {
      sum += 3 * digit;
    }
  }
  return sum % 10 === 0;
};

const ExpirationAlert = ({expirationDate}: { expirationDate: Date | null }) => {
  const {toast} = useToast();

  useEffect(() => {
    if (!expirationDate) {
      return;
    }

    const now = new Date();
    const timeDiff = expirationDate.getTime() - now.getTime();
    const daysUntilExpiration = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysUntilExpiration <= 30 && daysUntilExpiration > 7) {
      toast({
        title: 'Alerta de Validade',
        description: `Produto expira em ${daysUntilExpiration} dias.`,
      });
    } else if (daysUntilExpiration <= 7 && daysUntilExpiration >= 0) {
      toast({
        title: 'Aviso de Validade',
        description: `Produto expira em ${daysUntilExpiration} dias!`,
      });
    } else if (daysUntilExpiration < 0) {
      toast({
        title: 'Produto Expirado',
        description: 'Este produto já expirou!',
      });
    }
  }, [expirationDate, toast]);

  return null; // This component doesn't render anything
};

// Function to fetch product name from an external API
const fetchProductName = async (eanCode: string): Promise<string> => {
  try {
    // Replace with actual API endpoint that supports Angola
    const apiUrl = `https://world.openfoodfacts.org/api/v0/product/${eanCode}.json`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status === 1 && data.product) {
      // Prioritize product name in Portuguese if available
      if (data.product.product_name_pt) {
        return data.product.product_name_pt;
      }
      return data.product.product_name;
    } else {
      console.warn(`Product with EAN ${eanCode} not found in external API`);
      return ''; // Return empty string if product not found
    }
  } catch (error) {
    console.error('Error fetching product name:', error);
    return ''; // Return empty string on error
  }
};

const getProductName = async (eanCode: string, setManualNaming: (value: boolean) => void) => {
  try {
    // First, try to fetch from the external API
    let productName = await fetchProductName(eanCode);

    // If the external API doesn't return a name, fallback to Genkit
    if (!productName) {
      try {
        const result = await generateProductName({eanCode});
        productName = result.productName;
      } catch (error) {
        console.error('Error generating product name:', error);
        productName = '';
      }
    }

    if (!productName) {
      setManualNaming(true);
      return 'Nome do Produto Não Encontrado';
    } else {
      setManualNaming(false);
      return productName;
    }
  } catch (error) {
    console.error('Error in getProductName:', error);
    return 'Erro ao obter nome do produto';
  }
};

export default function Home() {
  const [eanCode, setEanCode] = useState('');
  const [productName, setProductName] = useState<string>('');
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [scannedProducts, setScannedProducts] = useState<Product[]>([]);
  const router = useRouter();
  const {toast} = useToast();
  const [isEanValid, setIsEanValid] = useState(true);
  const [isManualNamingOpen, setIsManualNamingOpen] = useState(false);
  const [manualProductName, setManualProductName] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scanType, setScanType] = useState<'camera' | 'manual'>('camera');

  useEffect(() => {
    // Load products from local storage on component mount
    const storedProducts = localStorage.getItem('scannedProducts');
    if (storedProducts) {
      setScannedProducts(JSON.parse(storedProducts).map((product: any) => ({
        ...product,
        expirationDate: product.expirationDate ? new Date(product.expirationDate) : null,
        quantity: product.quantity || 1,
      })));
    }
  }, []);

  useEffect(() => {
    // Save products to local storage whenever scannedProducts changes
    localStorage.setItem('scannedProducts', JSON.stringify(scannedProducts));
  }, [scannedProducts]);

  const handleScan = async () => {
    if (!isValidEan(eanCode)) {
      setIsEanValid(false);
      toast({
        title: 'Error',
        description: 'Código EAN inválido.',
      });
      return;
    }

    setIsEanValid(true);

    if (!expirationDate) {
      toast({
        title: 'Error',
        description: 'Por favor, selecione uma data de validade.',
      });
      return;
    }

    const parsedQuantity = Number(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        toast({
            title: 'Error',
            description: 'A quantidade deve ser um número maior que zero.',
        });
        return;
    }

    if (quantity <= 0) {
      toast({
        title: 'Error',
        description: 'A quantidade deve ser maior que zero.',
      });
      return;
    }

    getProductName(eanCode, setIsManualNamingOpen).then(generatedProductName => {
      setProductName(generatedProductName);
      if (generatedProductName === 'Nome do Produto Não Encontrado') {
        // Open the dialog for manual naming
        return;
      }

      const newProduct: Product = {
        eanCode,
        productName: generatedProductName,
        expirationDate,
        quantity,
      };

      setScannedProducts([...scannedProducts, newProduct]);
      setEanCode('');
      setExpirationDate(null);
      setQuantity(1);

      toast({
        title: 'Sucesso',
        description: 'Produto escaneado e salvo.',
      });
    });
  };

  const confirmManualNaming = () => {
    if (manualProductName.trim() === '') {
      toast({
        title: 'Error',
        description: 'Por favor, insira um nome para o produto.',
      });
      return;
    }

    const newProduct: Product = {
      eanCode,
      productName: manualProductName,
      expirationDate,
      quantity,
    };

    setScannedProducts([...scannedProducts, newProduct]);
    setEanCode('');
    setExpirationDate(null);
    setQuantity(1);
    setIsManualNamingOpen(false);
    setManualProductName('');

    toast({
      title: 'Sucesso',
      description: 'Produto escaneado e salvo com nome manual.',
    });
  };

  const sortedProducts = [...scannedProducts].sort((a, b) => {
    if (!a.expirationDate || !b.expirationDate) {
      return 0;
    }
    return a.expirationDate.getTime() - b.expirationDate.getTime();
  });

  const exportToExcel = async () => {
    const XLSX = (await import('xlsx')) as typeof XLSXTYPE;

    if (!sortedProducts?.length) return;

    const data = sortedProducts.map(product => ({
      'Código EAN': product.eanCode,
      'Nome do Produto': product.productName,
      'Data de Validade': product.expirationDate instanceof Date
        ? format(product.expirationDate, 'dd/MM/yyyy')
        : 'Sem data',
      'Quantidade': product.quantity,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Validades');
    XLSX.writeFile(wb, 'validades.xlsx');
  };


  const shareExcel = async () => {
    try {
      const XLSX = (await import('xlsx')) as typeof XLSXTYPE;
      const data = sortedProducts.map(product => ({
        'Código EAN': product.eanCode,
        'Nome do Produto': product.productName,
        'Data de Validade': product.expirationDate ? format(product.expirationDate, 'dd/MM/yyyy') : 'Sem data',
        'Quantidade': product.quantity,
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Validades');
      const excelData = XLSX.write(wb, {bookType: 'xlsx', type: 'array'});
      const excelBlob = new Blob([excelData], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const excelFile = new File([excelBlob], 'validades.xlsx', {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});

      if (navigator.share) {
        navigator.share({
          title: 'Lista de Validades',
          text: 'Lista de validades de produtos escaneados.',
          files: [excelFile],
        })
          .then(() => console.log('Compartilhado com sucesso'))
          .catch((error) => console.error('Erro ao compartilhar:', error));
      } else {
        toast({
          title: 'Erro',
          description: 'Compartilhamento não suportado neste navegador.',
        });
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao gerar ou compartilhar o arquivo Excel.',
      });
    }
  };

  // Function to delete a product from the scanned products list
  const deleteProduct = (index: number) => {
    const updatedProducts = [...scannedProducts];
    updatedProducts.splice(index, 1);
    setScannedProducts(updatedProducts);
    toast({
      title: 'Sucesso',
      description: 'Produto removido da lista.',
    });
  };

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}});
        setHasCameraPermission(true);
        setIsCameraActive(true); // Automatically start the camera
        // if (videoRef.current) {
        //   videoRef.current.srcObject = stream;
        // }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };
      getCameraPermission();
  }, []);

  const handleCameraScan = () => {
    try {
      setIsCameraActive(!isCameraActive);
    } catch (error) {
      console.error('Error toggling camera:', error);
      toast({
        variant: 'destructive',
        title: 'Camera Error',
        description: 'Failed to toggle camera. Please try again.',
      });
    }
  };

  const handleBarcodeDetected = (code: string) => {
    setEanCode(code);
    setIsCameraActive(false);
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4">
      <header className="w-full text-center mb-8">
        <div className="absolute top-4 right-4">
            <ThemeToggle/>
        </div>
        <h1 className="text-2xl font-bold text-primary">ValidaFácil</h1>
        <p className="text-muted-foreground">Escaneie produtos e acompanhe as datas de validade</p>
      </header>

      <Card className="w-full max-w-md mb-4">
        <CardHeader>
          <CardTitle>Scanear Produto</CardTitle>
          <CardDescription>Insira o código EAN e a data de validade</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex justify-around">
            <Button
              variant={scanType === 'manual' ? 'default' : 'outline'}
              onClick={() => setScanType('manual')}
              disabled={hasCameraPermission}
            >
              Digitar EAN
            </Button>
            <Button
              variant={scanType === 'camera' ? 'default' : 'outline'}
              onClick={() => setScanType('camera')}
              disabled={!hasCameraPermission}
            >
              Escanear com Câmera
            </Button>
          </div>

          {scanType === 'camera' && hasCameraPermission ? (
            <div className="relative">
              <BarcodeScannerComponent onBarcodeDetected={handleBarcodeDetected} isCameraActive={isCameraActive}/>
            </div>
          ) : null}

          {scanType === 'camera' && !hasCameraPermission && (
            <Alert variant="destructive">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>
                Please allow camera access to use this feature.
              </AlertDescription>
            </Alert>
          )}

          {scanType === 'manual' ? (
            <div className="grid gap-2">
              <Input
                type="number"
                placeholder="Código EAN"
                value={eanCode}
                onChange={(e) => setEanCode(e.target.value)}
              />
              {!isEanValid && <p className="text-red-500 text-sm">Código EAN inválido</p>}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Input
              type="number"
              placeholder="Quantidade"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              
              min={1}
            />
          </div>
          <div className="grid gap-2">
            <Calendar
              mode="single"
              selected={expirationDate}
              onSelect={setExpirationDate}
              className="rounded-md border"
            />
            {expirationDate ? (
              <p className="text-muted-foreground">
                Data selecionada: {format(expirationDate, 'PPP')}
              </p>
            ) : (
              <p className="text-muted-foreground">Por favor, selecione uma data.</p>
            )}
          </div>
          <Button onClick={handleScan} className="bg-primary text-primary-foreground">
            <Icons.barcode className="w-4 h-4 mr-2"/>
            Escanear Produto
          </Button>
        </CardContent>
      </Card>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Produtos Escaneados</CardTitle>
          <CardDescription>Lista de produtos escaneados ordenados por data de validade</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedProducts.length === 0 ? (
            <p>Nenhum produto escaneado ainda.</p>
          ) : (
            <ul className="list-none p-0">
              {sortedProducts.map((product, index) => (
                <li key={index} className="py-2 border-b border-border flex items-center justify-between">
                  <div>
                    <div className="font-bold">{product.productName}</div>
                    <div>EAN: {product.eanCode}</div>
                    <div>Quantidade: {product.quantity}</div>
                    <div>
                      Validade:{' '}
                      {product.expirationDate
                        ? format(product.expirationDate, 'PPP')
                        : 'Sem data de validade'}
                    </div>
                    <ExpirationAlert expirationDate={product.expirationDate}/>
                  </div>
                  <Button onClick={() => deleteProduct(index)} variant="destructive" size="icon">
                    <Icons.trash className="w-4 h-4"/>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between mt-4">
            <Button onClick={exportToExcel} variant="secondary">
              Exportar para Excel
            </Button>
            <Button onClick={shareExcel} variant="secondary">
              Compartilhar Excel
            </Button>
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={isManualNamingOpen} onOpenChange={setIsManualNamingOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nomear Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Produto não encontrado. Por favor, insira um nome para o produto com código EAN {eanCode}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="text"
            placeholder="Nome do Produto"
            value={manualProductName}
            onChange={(e) => setManualProductName(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsManualNamingOpen(false);
              setEanCode('');
              setExpirationDate(null);
              setQuantity(1);
            }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmManualNaming}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Footer */}
      <footer className="w-full text-center mt-8 p-4 text-muted-foreground">
        © 2024 Evandro Fernandes. Todos os direitos reservados.
      </footer>
    </div>
  );
}

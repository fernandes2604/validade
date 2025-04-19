"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from 'xlsx';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BrowserMultiFormatReader } from '@zxing/browser';

interface ScanData {
  barcode: string;
  name: string;
  quantity: number;
  expiryDate: Date | null;
}

export default function Home() {
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState<number | undefined>(undefined);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [scanDataList, setScanDataList] = useState<ScanData[]>([]);
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const codeReader = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    codeReader.current = new BrowserMultiFormatReader();

    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Camera error:', error);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Enable camera permissions in your browser.',
        });
      }
    };

    getCameraPermission();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [toast]);

  useEffect(() => {
    const found = scanDataList.find(item => item.barcode === barcode);
    if (found) {
      setName(found.name);
    } else if (barcode) {
      setName('');
      toast({ title: 'Novo código', description: 'Insira o nome do produto.' });
    }
  }, [barcode, scanDataList, toast]);

  const handleCapture = async () => {
    if (!hasCameraPermission || !videoRef.current || !codeReader.current) return;

    setIsProcessing(true);
    try {
      const result = await codeReader.current.decodeOnceFromVideoElement(videoRef.current);
      if (result) {
        setBarcode(result.getText());
        toast({ title: 'Código Capturado', description: result.getText() });
      } else {
        toast({ title: 'Código Não Detectado', description: 'Tente novamente.' });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao capturar código.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddData = () => {
    if (!barcode || !name || quantity === undefined || !expiryDate) {
      toast({ title: "Erro", description: "Preencha todos os campos." });
      return;
    }

    const newScanData: ScanData = { barcode, name, quantity, expiryDate };
    setScanDataList([...scanDataList, newScanData]);
    setBarcode('');
    setName('');
    setQuantity(undefined);
    setExpiryDate(null);
    toast({ title: "Sucesso", description: "Dados adicionados com sucesso." });
  };

  const handleExportToExcel = () => {
    if (scanDataList.length === 0) {
      toast({ title: "Erro", description: "Nenhum dado para exportar." });
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(scanDataList.map(item => ({
      Barcode: item.barcode,
      Name: item.name,
      Quantity: item.quantity,
      "Expiry Date": item.expiryDate ? format(item.expiryDate, 'yyyy-MM-dd') : '',
    })));

    XLSX.utils.book_append_sheet(wb, ws, "Scan Data");
    XLSX.writeFile(wb, "scan_data.xlsx");
    toast({ title: "Sucesso", description: "Dados exportados para Excel." });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Valida fácil</h1>

      <div className="mb-4 border-dashed rounded-lg p-4 bg-secondary">
        <p className="mb-2 text-sm text-muted-foreground">
          Aponte a câmera para o código de barras e clique em <strong>Capturar</strong> para ler o código.
        </p>

        <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted />

        {!hasCameraPermission && (
          <Alert variant="destructive" className="mt-2">
            <AlertTitle>Permissão da Câmera</AlertTitle>
            <AlertDescription>Ative a câmera nas configurações do navegador.</AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full md:w-auto mt-2"
          onClick={handleCapture}
          disabled={!hasCameraPermission || isProcessing}
        >
          {isProcessing ? '🔍 Processando...' : '📸 Capturar Código de Barras'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Input
          type="text"
          placeholder="Código Capturado"
          className={barcode ? "border-green-500" : ""}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />

        <Input
          type="text"
          placeholder="Nome do Produto"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          type="number"
          placeholder="Quantidade"
          value={quantity === undefined ? '' : quantity}
          onChange={(e) => setQuantity(e.target.valueAsNumber)}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expiryDate && "text-muted-foreground")}> 
              <CalendarIcon className="mr-2 h-4 w-4" />
              {expiryDate ? format(expiryDate, "yyyy-MM-dd") : <span>Escolher Data</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center" side="bottom">
            <Calendar
              mode="single"
              selected={expiryDate}
              onSelect={setExpiryDate}
              disabled={(date) => date < new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button className="w-full md:w-auto mb-4" onClick={handleAddData}>Adicionar</Button>

      <div className="overflow-x-auto">
        <Table>
          <TableCaption>Lista de Produtos Escaneados.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Validade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scanDataList.map((data, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{data.barcode}</TableCell>
                <TableCell>{data.name}</TableCell>
                <TableCell>{data.quantity}</TableCell>
                <TableCell>{data.expiryDate ? format(data.expiryDate, 'yyyy-MM-dd') : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right">
                <Button onClick={handleExportToExcel}>Exportar para Excel</Button>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <footer className="mt-8 text-center text-muted-foreground">
        © 2025 Evandro Fernandes
      </footer>
    </div>
  );
}

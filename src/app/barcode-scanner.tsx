'use client';

import React, {useState, useEffect, useRef} from 'react';
import {useToast} from '@/hooks/use-toast';
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";

interface BarcodeScannerProps {
  onBarcodeDetected: (code: string) => void;
  isCameraActive: boolean;
}

const BarcodeScannerComponent: React.FC<BarcodeScannerProps> = ({onBarcodeDetected, isCameraActive}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const {toast} = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}});
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
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

    if (isCameraActive) {
      getCameraPermission();
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        } catch (error) {
          console.error("Error stopping camera:", error);
        }
      }
    };
  }, [isCameraActive, toast]);

  useEffect(() => {
    let barcodeDetector: any;

    const loadBarcodeDetector = async () => {
      try {
        barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['ean_13'],
        });
      } catch (error: any) {
        console.error('BarcodeDetector is not supported in this browser:', error);
        toast({
          variant: 'destructive',
          title: 'Barcode Scanner Error',
          description: 'Barcode scanning is not supported in your browser. Please try a different browser or enter the EAN code manually.',
        });
        return;
      }

      if (videoRef.current) {
        const detectBarcodes = async () => {
          if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
            requestAnimationFrame(detectBarcodes);
            return;
          }
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              onBarcodeDetected(code);

              // Stop the camera
              if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
                videoRef.current.srcObject = null;
              }
            } else {
              requestAnimationFrame(detectBarcodes);
            }
          } catch (error: any) {
            console.error('Error detecting barcodes:', error);
            if (error.name === 'TypeError' && error.message.includes('No frames')) {
              // This error is expected when the video is not playing or has no data
              requestAnimationFrame(detectBarcodes);
            } else {
              toast({
                variant: 'destructive',
                title: 'Barcode Scanner Error',
                description: 'There was an error scanning the barcode. Please try again.',
              });
            }
          }
        };
        if (isCameraActive && videoRef.current.srcObject) { // Check if the video stream is active
        try {
          detectBarcodes();
        } catch (error) {
          console.error('Error during barcode detection:', error);
          toast({
            variant: 'destructive',
            title: 'Barcode Scanner Error',
            description: 'An unexpected error occurred while scanning. Please try again.',
          });
        }
        }
      }
    };

    if ('BarcodeDetector' in window) {
      loadBarcodeDetector();
    } else {
      console.error('BarcodeDetector is not supported in this browser.');
      toast({
        variant: 'destructive',
        title: 'Browser Not Supported',
        description: 'Barcode scanning is not supported in your browser. Please try a different browser or enter the EAN code manually.',
      });
    }
    return () => {
      // Cleanup function to stop the camera when the component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        } catch (error) {
          console.error("Error stopping camera in cleanup:", error);
        }
      }
    };
  }, [isCameraActive, onBarcodeDetected, toast]);

  return (
    <div className="relative">
      {hasCameraPermission && isCameraActive ? (
        <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Camera Access Required</AlertTitle>
          <AlertDescription>
            Please allow camera access to use this feature.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default BarcodeScannerComponent;

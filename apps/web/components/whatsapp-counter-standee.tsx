'use client';

import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, MessageSquare, Sparkles, Store, ShoppingBag } from 'lucide-react';

interface WhatsappCounterStandeeProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  whatsappPhone: string;
  logoUrl?: string | null;
}

export function WhatsappCounterStandee({
  isOpen,
  onClose,
  businessName,
  whatsappPhone,
  logoUrl,
}: WhatsappCounterStandeeProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const formattedPhone = (whatsappPhone || '').replace(/\D/g, '');
  const encodedText = encodeURIComponent('Hi Obix, I want to place an order:');
  const waUrl = `https://wa.me/${formattedPhone}?text=${encodedText}`;
  // High quality Google Chart QR API URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(waUrl)}`;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>WhatsApp Order Standee - ${businessName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              margin: 0;
              padding: 40px;
              display: flex;
              justify-content: center;
              align-items: center;
              background-color: #f8fafc;
            }
            .standee-card {
              width: 380px;
              background: #ffffff;
              border-radius: 32px;
              padding: 36px 28px;
              text-align: center;
              box-shadow: 0 20px 40px rgba(0,0,0,0.08);
              border: 2px solid #25d366;
            }
            .header-badge {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              background: #dcfce7;
              color: #166534;
              font-weight: 700;
              font-size: 13px;
              padding: 8px 16px;
              border-radius: 99px;
              margin-bottom: 20px;
            }
            .shop-title {
              font-size: 24px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 6px 0;
            }
            .shop-subtitle {
              font-size: 13px;
              color: #64748b;
              margin-bottom: 24px;
            }
            .qr-box {
              background: #f1f5f9;
              padding: 20px;
              border-radius: 24px;
              display: inline-block;
              margin-bottom: 20px;
              border: 1px border #e2e8f0;
            }
            .qr-box img {
              width: 220px;
              height: 220px;
              display: block;
              border-radius: 12px;
            }
            .instruction-step {
              font-size: 13px;
              font-weight: 600;
              color: #334155;
              margin: 6px 0;
            }
            .footer-tag {
              margin-top: 24px;
              font-size: 11px;
              font-weight: 700;
              color: #94a3b8;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            @media print {
              body { background: white; padding: 0; }
              .standee-card { box-shadow: none; border-color: #25d366; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            WhatsApp Order Counter Standee
          </DialogTitle>
          <DialogDescription>
            Print and place this QR code poster at your shop counter. Customers can scan to order directly on WhatsApp!
          </DialogDescription>
        </DialogHeader>

        {/* Printable Standee Preview Box */}
        <div className="my-4 flex justify-center">
          <div
            ref={printRef}
            className="w-full max-w-[340px] bg-gradient-to-b from-emerald-50/80 via-white to-slate-50 border-2 border-emerald-400 rounded-3xl p-6 text-center shadow-lg relative overflow-hidden"
          >
            {/* Header Badge */}
            <div className="inline-flex items-center gap-1.5 bg-emerald-100/90 text-emerald-800 font-extrabold text-xs px-3.5 py-1.5 rounded-full mb-4 shadow-sm">
              <MessageSquare className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
              <span>ORDER DIRECTLY ON WHATSAPP</span>
            </div>

            {/* Shop Name */}
            <h3 className="text-xl font-black text-slate-900 line-clamp-1">{businessName}</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5 mb-4">Scan QR to send items list or voice note</p>

            {/* QR Code Container */}
            <div className="bg-white p-3.5 rounded-2xl inline-block shadow-md border border-slate-200/80 my-1">
              <img
                src={qrCodeUrl}
                alt="WhatsApp Order QR Code"
                className="w-48 h-48 rounded-xl object-contain mx-auto"
              />
            </div>

            {/* Step Instructions */}
            <div className="mt-4 space-y-1.5 text-xs text-slate-700 font-semibold bg-white/70 backdrop-blur-sm p-3 rounded-2xl border border-emerald-100">
              <p>📷 1. Open Phone Camera & Scan QR</p>
              <p>💬 2. Send your item list on WhatsApp</p>
              <p>⚡ 3. Receive instant bill & confirmation!</p>
            </div>

            {/* Footer */}
            <p className="mt-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Powered by OBIX Smart POS
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1 rounded-2xl h-11" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-2xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4" />
            Print Standee
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

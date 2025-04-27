
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as pdf from 'https://deno.land/x/pdfkit@v0.5.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { headers, rows, title, date } = await req.json();

    const doc = new pdf.default();
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

    // Add title
    doc.fontSize(16).text(title, { align: 'center' });
    doc.fontSize(12).text(date, { align: 'center' });
    doc.moveDown();

    // Add table headers
    const columnWidth = 150;
    let y = doc.y;
    headers.forEach((header: string, i: number) => {
      doc.text(header, i * columnWidth, y, { width: columnWidth, align: 'center' });
    });

    // Add rows
    y += 20;
    rows.forEach((row: any[]) => {
      row.forEach((cell, i) => {
        doc.text(String(cell), i * columnWidth, y, { width: columnWidth, align: 'center' });
      });
      y += 20;
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
    });

    doc.end();

    const pdfBytes = new Uint8Array(Buffer.concat(chunks));

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=report.pdf'
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

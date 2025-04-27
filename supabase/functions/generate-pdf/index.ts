
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as pdf from 'https://deno.land/x/pdfkit@v0.5.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Log the request method and URL
  console.log(`PDF Generation: Received ${req.method} request`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { headers, rows, title, date } = await req.json();
    
    console.log(`PDF Generation: Creating document with ${headers?.length || 0} columns and ${rows?.length || 0} rows`);
    console.log(`PDF Generation: Title: "${title}", Date: "${date}"`);
    
    if (!headers || !Array.isArray(headers) || !rows || !Array.isArray(rows)) {
      throw new Error("Invalid data format: headers and rows must be arrays");
    }

    const doc = new pdf.default();
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk: Uint8Array) => {
      console.log(`PDF Generation: Received chunk of size ${chunk.length}`);
      chunks.push(chunk);
    });

    // Add title
    doc.fontSize(16).text(title, { align: 'center' });
    doc.fontSize(12).text(date, { align: 'center' });
    doc.moveDown();

    // Add table headers
    const columnWidth = 150;
    let y = doc.y;
    console.log(`PDF Generation: Adding headers at y=${y}`);
    headers.forEach((header: string, i: number) => {
      doc.text(header, i * columnWidth, y, { width: columnWidth, align: 'center' });
    });

    // Add rows
    y += 20;
    console.log(`PDF Generation: Adding rows starting at y=${y}`);
    rows.forEach((row: any[], rowIndex: number) => {
      if (rowIndex % 10 === 0) {
        console.log(`PDF Generation: Processing row ${rowIndex}/${rows.length}`);
      }
      
      row.forEach((cell, i) => {
        doc.text(String(cell), i * columnWidth, y, { width: columnWidth, align: 'center' });
      });
      y += 20;
      if (y > 700) {
        console.log(`PDF Generation: Adding new page at row ${rowIndex}`);
        doc.addPage();
        y = 50;
      }
    });

    console.log("PDF Generation: Finishing document");
    doc.end();

    const pdfBytes = new Uint8Array(Buffer.concat(chunks));
    console.log(`PDF Generation: Document complete, total size ${pdfBytes.length} bytes`);

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=report.pdf'
      },
    });
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createPdf } from 'https://deno.land/x/pdfjs@v0.1.1/mod.ts';

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

    // Create a new PDF document
    const pdf = await createPdf();
    
    // Add content to the PDF
    pdf.text(title || "PDKS Report", { x: 250, y: 50, align: 'center', size: 16 });
    pdf.text(date || new Date().toLocaleDateString(), { x: 250, y: 70, align: 'center', size: 12 });
    
    // Set up table parameters
    const startY = 100;
    const cellPadding = 10;
    const columnWidth = 500 / headers.length;
    let currentY = startY;
    
    // Draw table headers
    headers.forEach((header, i) => {
      const x = 50 + (i * columnWidth);
      pdf.text(String(header), { x, y: currentY, size: 12, align: 'center' });
    });
    
    currentY += 30;
    
    // Draw horizontal line after headers
    pdf.line(50, currentY - 15, 550, currentY - 15);
    
    // Draw table rows
    rows.forEach((row, rowIndex) => {
      // Add new page if needed
      if (currentY > 750) {
        pdf.pageBreak();
        currentY = 50;
      }
      
      // Draw row data
      row.forEach((cell, i) => {
        const x = 50 + (i * columnWidth);
        pdf.text(String(cell), { x, y: currentY, size: 10, align: 'center' });
      });
      
      currentY += 25;
      
      // Draw light horizontal line between rows
      pdf.line(50, currentY - 10, 550, currentY - 10, { color: '#DDDDDD' });
    });
    
    // Generate the PDF as bytes
    const pdfBytes = await pdf.save();
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

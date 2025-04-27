
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import "https://esm.sh/jspdf-autotable@3.8.2";

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

    // Create a new PDF document
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    // Add date
    doc.setFontSize(12);
    doc.text(date, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
    
    // Add table
    (doc as any).autoTable({
      head: [headers],
      body: rows,
      startY: 40,
      theme: 'grid',
      styles: {
        fontSize: 10,
      },
      headStyles: {
        fillColor: [66, 66, 66],
        textColor: 255,
      },
      margin: { top: 40 },
    });
    
    // Convert to bytes
    const pdfBytes = doc.output('arraybuffer');

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

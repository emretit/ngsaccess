
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, date, headers, rows } = await req.json();

    // Create PDF with PDFKit
    const pdf = await generatePDF(title, date, headers, rows);

    // Return the PDF as a response
    return new Response(pdf, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=pdks_report_${new Date().toISOString().slice(0, 10)}.pdf`
      }
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generatePDF(title, date, headers, rows) {
  // This is a simplified PDF generation function
  // In a real implementation, you would use a PDF generation library
  
  // Here we'll create a very basic PDF using HTML and convert it to PDF format
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; }
        h1 { color: #333; text-align: center; }
        .date { text-align: center; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="date">Tarih: ${date}</div>
      <table>
        <thead>
          <tr>
            ${headers.map(header => `<th>${header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  // For this example, we're returning the HTML as text
  // In a real implementation, you would convert this to PDF
  // Using a library like puppeteer or jspdf
  
  // For demonstration purposes, let's return the HTML with a PDF content type
  // This won't be a real PDF, but it simulates the concept
  return new TextEncoder().encode(html);
}

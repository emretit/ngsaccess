
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Generate HTML content for PDF
    const htmlContent = generateHTMLTable(headers, rows, title, date);
    
    // Convert HTML to PDF using native response with content-type
    const pdfResponse = new Response(htmlContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
        'Content-Disposition': 'attachment; filename=pdks_rapor.pdf'
      },
    });
    
    console.log(`PDF Generation: Document complete, sending HTML response for browser PDF generation`);
    
    return pdfResponse;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Function to generate an HTML table that can be printed as PDF
function generateHTMLTable(headers: string[], rows: any[][], title: string, date: string): string {
  // Create a styled HTML document that will render nicely when printed to PDF
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title || "PDKS Raporu"}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        h1 {
          font-size: 24px;
          margin-bottom: 10px;
        }
        .date {
          font-size: 14px;
          color: #666;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          background-color: #f2f2f2;
          padding: 12px 8px;
          text-align: left;
          font-weight: bold;
          border-bottom: 2px solid #ddd;
        }
        td {
          padding: 10px 8px;
          border-bottom: 1px solid #ddd;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        @media print {
          body {
            margin: 0;
            padding: 20px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4;
            margin: 2cm;
          }
        }
      </style>
      <script>
        // Auto-trigger print dialog when the page loads
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        }
      </script>
    </head>
    <body>
      <div class="header">
        <h1>${title || "PDKS Raporu"}</h1>
        <div class="date">${date || new Date().toLocaleDateString('tr-TR')}</div>
      </div>
      
      <table>
        <thead>
          <tr>
            ${headers.map(header => `<th>${header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell !== null && cell !== undefined ? cell : '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  return html;
}

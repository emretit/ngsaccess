
const { Resend } = require('resend');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Initialize Resend with API key from environment variables
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Parse request body
    const { employee_id, email, first_name, last_name } = JSON.parse(event.body);

    if (!employee_id || !email || !first_name || !last_name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Generate a secure token
    const token = require('crypto').randomUUID();
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Create setup URL
    const siteUrl = process.env.URL || 'http://localhost:8080';
    const setupUrl = `${siteUrl}/employee-setup?token=${token}`;

    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: "PDKS Sistemi <onboarding@resend.dev>",
      to: [email],
      subject: "PDKS Sistemi - Şifre Belirleme",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #711A1A; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { 
              display: inline-block; 
              background: #711A1A; 
              color: white; 
              padding: 12px 30px; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
              font-weight: bold;
            }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 PDKS Sistemi</h1>
              <p>Personel Devam Kontrol Sistemi</p>
            </div>
            <div class="content">
              <h2>Merhaba ${first_name} ${last_name},</h2>
              
              <p>PDKS sistemine hoş geldiniz! Sisteme giriş yapabilmek için şifrenizi belirlemeniz gerekmektedir.</p>
              
              <p><strong>Şifrenizi belirlemek için aşağıdaki butona tıklayın:</strong></p>
              
              <a href="${setupUrl}" class="button">Şifremi Belirle</a>
              
              <div class="warning">
                <strong>⚠️ Önemli Güvenlik Bilgileri:</strong>
                <ul>
                  <li>Bu bağlantı 24 saat geçerlidir</li>
                  <li>Bağlantıyı sadece siz kullanabilirsiniz</li>
                  <li>Güçlü bir şifre seçiniz (en az 8 karakter, büyük/küçük harf, rakam)</li>
                  <li>Şifrenizi kimseyle paylaşmayınız</li>
                </ul>
              </div>
              
              <p>Eğer bu email'i beklemiyordunuz, lütfen sistem yöneticiniz ile iletişime geçiniz.</p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
              
              <p style="font-size: 12px; color: #666;">
                Bu email otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.<br>
                PDKS Sistemi - Resend.dev
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: "Setup email sent successfully",
        expires_at: expires_at.toISOString(),
        token: token // For storing in database
      }),
    };

  } catch (error) {
    console.error("Error in send-employee-setup-email function:", error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Failed to send email'
      }),
    };
  }
};

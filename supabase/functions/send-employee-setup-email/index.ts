
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmployeeSetupEmailRequest {
  employee_id: string;
  email: string;
  first_name: string;
  last_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employee_id, email, first_name, last_name }: EmployeeSetupEmailRequest = await req.json();
    
    // Create Supabase client for service role operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate a secure token
    const token = crypto.randomUUID();
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // First check if employee_auth record exists for this email
    const { data: existingAuth } = await supabase
      .from('employee_auth')
      .select('id')
      .eq('email', email)
      .single();

    let authError;
    
    if (existingAuth) {
      // Update existing record
      const { error } = await supabase
        .from('employee_auth')
        .update({
          setup_token: token,
          token_expires_at: expires_at.toISOString(),
          employee_id: employee_id
        })
        .eq('email', email);
      
      authError = error;
    } else {
      // Insert new record
      const { error } = await supabase
        .from('employee_auth')
        .insert({
          employee_id: employee_id,
          email: email,
          setup_token: token,
          token_expires_at: expires_at.toISOString(),
          password_hash: null
        });
      
      authError = error;
    }

    if (authError) {
      console.error('Error storing employee setup token:', authError);
      throw new Error('Failed to store employee setup token');
    }

    // Create setup URL
    const setupUrl = `https://ngsplus.app/employee-setup?token=${token}`;

    const emailResponse = await resend.emails.send({
      from: "NGSPlus.App <noreply@ngsplus.app>",
      to: [email],
      subject: "Şifre Belirleme",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              padding: 20px;
            }
            .container { 
              max-width: 400px; 
              margin: 0 auto; 
              background: white;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
              padding: 40px 30px;
              text-align: center;
              color: white;
            }
            .security-icon {
              width: 60px;
              height: 60px;
              background: rgba(255,255,255,0.2);
              border-radius: 50%;
              margin: 0 auto 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
            }
            .header h1 { 
              font-size: 24px; 
              font-weight: 600;
              margin-bottom: 8px;
            }
            .header p { 
              font-size: 14px; 
              opacity: 0.9;
            }
            .content { 
              padding: 40px 30px;
              text-align: center;
            }
            .greeting {
              font-size: 18px;
              font-weight: 600;
              color: #2c3e50;
              margin-bottom: 16px;
            }
            .message {
              font-size: 14px;
              color: #7f8c8d;
              line-height: 1.6;
              margin-bottom: 30px;
            }
            .info-card {
              background: #f8f9fa;
              border-radius: 12px;
              padding: 20px;
              margin: 20px 0;
              text-align: left;
            }
            .info-title {
              font-size: 14px;
              font-weight: 600;
              color: #2c3e50;
              margin-bottom: 12px;
            }
            .info-item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 13px;
            }
            .info-label {
              color: #7f8c8d;
            }
            .info-value {
              color: #2c3e50;
              font-weight: 500;
            }
            .button { 
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 16px 32px;
              text-decoration: none;
              border-radius: 25px;
              font-weight: 600;
              font-size: 16px;
              margin: 20px 0;
              transition: transform 0.2s;
            }
            .button:hover {
              transform: translateY(-2px);
            }
            .warning {
              background: #fff3cd;
              border: 1px solid #ffeaa7;
              border-radius: 8px;
              padding: 16px;
              margin: 20px 0;
              font-size: 12px;
              color: #856404;
            }
            .warning-title {
              font-weight: 600;
              margin-bottom: 8px;
            }
            .footer {
              text-align: center;
              padding: 20px;
              font-size: 12px;
              color: #95a5a6;
              border-top: 1px solid #ecf0f1;
            }
            @media only screen and (max-width: 480px) {
              body { padding: 10px; }
              .container { margin: 0; }
              .content { padding: 30px 20px; }
              .header { padding: 30px 20px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="security-icon">🔐</div>
              <h1>Şifre Belirleme</h1>
              <p>Hesabınızı güvenli hale getirin</p>
            </div>
            <div class="content">
              <div class="greeting">Merhaba ${first_name}!</div>
              <div class="message">
                NGSPlus.App sistemine hoş geldiniz. Hesabınızı aktifleştirmek için şifrenizi belirleyin.
              </div>
              
              <div class="info-card">
                <div class="info-title">Hesap Bilgileri</div>
                <div class="info-item">
                  <span class="info-label">Ad Soyad:</span>
                  <span class="info-value">${first_name} ${last_name}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">E-posta:</span>
                  <span class="info-value">${email}</span>
                </div>
              </div>
              
              <a href="${setupUrl}" class="button">Şifremi Belirle</a>
              
              <div class="warning">
                <div class="warning-title">⚠️ Güvenlik Uyarısı</div>
                • Bu bağlantı 24 saat geçerlidir<br>
                • Güçlü bir şifre kullanın<br>
                • Şifrenizi kimseyle paylaşmayın
              </div>
            </div>
            <div class="footer">
              Bu email otomatik olarak gönderilmiştir.<br>
              NGSPlus.App - ngsplus.app
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Employee setup email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Employee setup email sent successfully",
      expires_at: expires_at.toISOString()
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-employee-setup-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

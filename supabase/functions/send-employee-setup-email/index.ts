
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
  employee_id: number;
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

    // Store setup token in employees table
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        setup_token: token,
        token_expires_at: expires_at.toISOString()
      })
      .eq('id', employee_id);

    if (updateError) {
      console.error('Error storing setup token:', updateError);
      throw new Error('Failed to store setup token');
    }

    // Create setup URL - production domain kullan
    const setupUrl = `https://ngsplus.app/employee-setup?token=${token}`;

    const emailResponse = await resend.emails.send({
      from: "NGSPlus.App <noreply@ngsplus.app>",
      to: [email],
      subject: "NGSPlus.App - Personel Şifre Belirleme",
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
            .info-box { background: #e3f2fd; border: 1px solid #90caf9; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 NGSPlus.App'e hoş geldiniz</h1>
              <p>Personel Yönetim Sistemi</p>
            </div>
            <div class="content">
              <h2>Merhaba ${first_name} ${last_name},</h2>
              
              <p>NGSPlus.App sistemine hoş geldiniz! Size bir personel hesabı oluşturulmuş ve şifrenizi belirlemeniz için davet ediliyorsunuz.</p>
              
              <div class="info-box">
                <strong>📋 Hesap Bilgileriniz:</strong>
                <ul>
                  <li><strong>E-posta:</strong> ${email}</li>
                  <li><strong>Ad Soyad:</strong> ${first_name} ${last_name}</li>
                </ul>
              </div>
              
              <p><strong>Hesabınızı aktifleştirmek ve şifrenizi belirlemek için aşağıdaki butona tıklayın:</strong></p>
              
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
                NGSPlus.App - ngsplus.app
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Employee setup email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Setup email sent successfully",
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

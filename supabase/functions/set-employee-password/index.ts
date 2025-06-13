
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SetPasswordRequest {
  token: string;
  password: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password }: SetPasswordRequest = await req.json();
    
    if (!token || !password) {
      throw new Error('Token ve şifre gerekli');
    }

    // Create Supabase client for service role operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find the employee auth record with this token
    const { data: authData, error: findError } = await supabase
      .from('employee_auth')
      .select('id, email, token_expires_at, employee_id')
      .eq('setup_token', token)
      .single();

    if (findError || !authData) {
      console.error('Token not found:', findError);
      throw new Error('Geçersiz token');
    }

    // Check if token is expired
    const expiresAt = new Date(authData.token_expires_at);
    const now = new Date();
    
    if (now > expiresAt) {
      throw new Error('Token süresi dolmuş');
    }

    // Hash the password (in a real app, use proper password hashing)
    // For now, we'll store it as plain text for demo purposes
    const passwordHash = password; // In production, use bcrypt or similar

    // Update the employee_auth record with the new password
    const { error: updateError } = await supabase
      .from('employee_auth')
      .update({
        password_hash: passwordHash,
        setup_token: null,
        token_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', authData.id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('Şifre güncellenirken hata oluştu');
    }

    console.log('Employee password set successfully for:', authData.email);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password set successfully"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in set-employee-password function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

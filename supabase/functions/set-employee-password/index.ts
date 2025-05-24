
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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
      throw new Error('Token ve şifre gereklidir');
    }

    // Create Supabase client for service role operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate token and get employee info
    const { data: authData, error: authError } = await supabase
      .from('employee_auth')
      .select('employee_id, token_expires_at')
      .eq('setup_token', token)
      .single();

    if (authError || !authData) {
      throw new Error('Geçersiz token');
    }

    // Check if token is expired
    const expiresAt = new Date(authData.token_expires_at);
    const now = new Date();
    
    if (now > expiresAt) {
      throw new Error('Token süresi dolmuş');
    }

    // Hash the password
    const passwordHash = await hash(password);

    // Update employee_auth with new password and clear token
    const { error: updateError } = await supabase
      .from('employee_auth')
      .update({
        password_hash: passwordHash,
        setup_token: null,
        token_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('setup_token', token);

    if (updateError) {
      throw new Error('Şifre güncellenirken hata oluştu');
    }

    console.log('Password set successfully for employee:', authData.employee_id);

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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

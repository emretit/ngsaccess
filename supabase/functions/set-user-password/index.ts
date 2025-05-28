
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
      throw new Error('Token ve şifre gereklidir');
    }

    // Create Supabase client for service role operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate token and get user info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, token_expires_at')
      .eq('setup_token', token)
      .single();

    if (userError || !userData) {
      throw new Error('Geçersiz token');
    }

    // Check if token is expired
    const expiresAt = new Date(userData.token_expires_at);
    const now = new Date();
    
    if (now > expiresAt) {
      throw new Error('Token süresi dolmuş');
    }

    // Update user password using admin API
    const { error: passwordError } = await supabase.auth.admin.updateUserById(
      userData.id,
      { password: password }
    );

    if (passwordError) {
      throw new Error('Şifre güncellenirken hata oluştu: ' + passwordError.message);
    }

    // Clear the setup token
    const { error: tokenError } = await supabase
      .from('users')
      .update({
        setup_token: null,
        token_expires_at: null
      })
      .eq('setup_token', token);

    if (tokenError) {
      throw new Error('Token temizlenirken hata oluştu');
    }

    console.log('Password set successfully for user:', userData.email);

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
    console.error("Error in set-user-password function:", error);
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

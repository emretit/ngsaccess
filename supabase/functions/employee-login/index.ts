
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, phone, password } = await req.json();
    const identifier = email || phone;

    if (!identifier || !password) {
      return new Response(
        JSON.stringify({ error: "Email/phone and password are required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // First, find the employee_auth record
    const { data: authData, error: authError } = await supabase
      .from("employee_auth")
      .select("id, employee_id, password_hash")
      .or(`email.eq.${identifier},phone.eq.${identifier}`)
      .single();

    if (authError || !authData) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Verify password (in production, use proper password hashing)
    if (authData.password_hash !== password) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Get employee details
    const { data: employeeData, error: employeeError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, card_number, department_id")
      .eq("id", authData.employee_id)
      .single();

    if (employeeError || !employeeData) {
      return new Response(
        JSON.stringify({ error: "Employee not found" }),
        { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Create a JWT token for the employee
    const { data: tokenData, error: tokenError } = await supabase.auth.admin.createUser({
      email: employeeData.email,
      email_confirm: true,
      user_metadata: {
        employee_id: employeeData.id,
        full_name: `${employeeData.first_name} ${employeeData.last_name}`,
        card_number: employeeData.card_number
      },
      id: authData.id // Important: use the same ID as in employee_auth
    });

    if (tokenError) {
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Update last login time
    await supabase
      .from("employee_auth")
      .update({ last_login: new Date().toISOString() })
      .eq("id", authData.id);

    return new Response(
      JSON.stringify({
        user: {
          id: employeeData.id,
          email: employeeData.email,
          name: `${employeeData.first_name} ${employeeData.last_name}`,
          card_number: employeeData.card_number
        },
        session: tokenData.user
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

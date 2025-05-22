
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

  // Get the JWT token from the Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid authorization header" }),
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  const token = authHeader.replace("Bearer ", "");
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the token and get user data
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Get employee ID from user metadata
    const employeeId = user.user_metadata.employee_id;
    if (!employeeId) {
      return new Response(
        JSON.stringify({ error: "Employee ID not found in user metadata" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Get employee's PDKS records
    const { data: recordsData, error: recordsError } = await supabase
      .from("pdks_records")
      .select("*")
      .eq("employee_id", employeeId)
      .order("date", { ascending: false })
      .order("entry_time", { ascending: false });

    if (recordsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch records" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ records: recordsData }),
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

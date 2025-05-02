
import { supabase } from "@/integrations/supabase/client";
import { MessageData, QueryParams } from "../../types";

// Function to fetch card readings data based on query parameters
export async function fetchCardReadings(params: QueryParams): Promise<MessageData[]> {
  try {
    console.log("Fetching card readings with params:", params);
    
    let query = supabase
      .from('card_readings')
      .select(`
        id,
        access_time,
        employee_name,
        employees (
          first_name,
          last_name,
          department_id,
          departments (id, name)
        ),
        device_name,
        device_location
      `)
      .order('access_time', { ascending: true });
    
    // Apply date filter if provided
    if (params.date) {
      const date = new Date(params.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Format dates for Supabase query
      const formattedDate = date.toISOString();
      const formattedNextDay = nextDay.toISOString();
      
      query = query.gte('access_time', formattedDate).lt('access_time', formattedNextDay);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching card readings:", error);
      throw error;
    }
    
    console.log("Fetched data:", data);
    
    // Filter by department if provided
    let filteredData = data;
    if (params.department && data) {
      filteredData = data.filter(record => 
        record.employees?.departments?.name?.toLowerCase() === params.department?.toLowerCase()
      );
    }
    
    // Transform data to format needed for message display
    const messageData: MessageData[] = filteredData.map(record => ({
      name: record.employee_name || `${record.employees?.first_name || ''} ${record.employees?.last_name || ''}`.trim(),
      check_in: new Date(record.access_time).toLocaleString('tr-TR'),
      check_out: null, // Card readings don't have exit time by default
      department: record.employees?.departments?.name || 'Bilinmeyen',
      device: record.device_name || '-',
      location: record.device_location || '-'
    }));
    
    return messageData;
  } catch (error) {
    console.error("Error in fetchCardReadings:", error);
    throw error;
  }
}

// Function to fetch database context information for AI
export async function fetchDatabaseContext(): Promise<string> {
  // Get department information from the database
  const { data: departmentsData, error: departmentsError } = await supabase
    .from('departments')
    .select('*');
  
  if (departmentsError) {
    console.error("Error fetching departments:", departmentsError);
  }

  // Get employee information from the database
  const { data: employeesData, error: employeesError } = await supabase
    .from('employees')
    .select(`
      *,
      departments (id, name),
      positions (id, name)
    `);
  
  if (employeesError) {
    console.error("Error fetching employees:", employeesError);
  }

  // Create a context with database information
  let dbContext = "System database information:";
  
  if (departmentsData && departmentsData.length > 0) {
    dbContext += `\nDepartments: ${departmentsData.map(d => `${d.id}: ${d.name}`).join(", ")}`;
  }
  
  if (employeesData && employeesData.length > 0) {
    dbContext += `\nEmployees: ${employeesData.map(e => `${e.first_name} ${e.last_name} (${e.departments?.name || 'No Department'} department, ${e.positions?.name || 'No Position'})`).join("; ")}`;
  }
  
  return dbContext;
}

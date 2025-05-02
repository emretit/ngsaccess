
import { extractDateFromQuery } from './dateParser';
import { extractDepartmentFromQuery } from './departmentParser';
import { QueryParams } from '../../types';

// Function to parse natural language query and extract parameters
export function parseQuery(query: string): QueryParams {
  const dateStr = extractDateFromQuery(query);
  const department = extractDepartmentFromQuery(query);
  
  return {
    department,
    date: dateStr
  };
}

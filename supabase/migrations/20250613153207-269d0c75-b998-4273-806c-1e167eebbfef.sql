
-- Add access_rule_id column to employees table
ALTER TABLE employees 
ADD COLUMN access_rule_id bigint REFERENCES access_rules(id);

-- Add index for better performance
CREATE INDEX idx_employees_access_rule_id ON employees(access_rule_id);

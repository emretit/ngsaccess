
-- "Genel Çalışan Erişimi" kuralına 5 ek çalışan ekle
INSERT INTO group_members (group_id, employee_id, project_id)
SELECT 
    ar.id as group_id,
    e.id as employee_id,
    1 as project_id
FROM access_rules ar
CROSS JOIN (
    SELECT id 
    FROM employees 
    WHERE project_id = 1 OR project_id IS NULL
    AND id NOT IN (
        SELECT gm.employee_id 
        FROM group_members gm 
        JOIN access_rules ar2 ON gm.group_id = ar2.id 
        WHERE ar2.name = 'Genel Çalışan Erişimi'
    )
    ORDER BY id
    LIMIT 5
) e
WHERE ar.name = 'Genel Çalışan Erişimi';


import { NaturalLanguageQuery } from './parsers/turkishNlpParser';

export class SqlQueryBuilder {
  static buildQuery(nlQuery: NaturalLanguageQuery): string {
    let query = '';
    let joins = new Set<string>();
    let conditions: string[] = [];
    let groupBy: string[] = [];
    let orderBy = '';
    
    // Ana SELECT ve FROM kısmı
    switch (nlQuery.intent) {
      case 'list':
        query = this.buildListQuery(nlQuery, joins, conditions);
        break;
      case 'count':
        query = this.buildCountQuery(nlQuery, joins, conditions, groupBy);
        break;
      case 'late':
        query = this.buildLateQuery(nlQuery, joins, conditions);
        break;
      case 'absent':
        query = this.buildAbsentQuery(nlQuery, joins, conditions);
        break;
      case 'present':
        query = this.buildPresentQuery(nlQuery, joins, conditions);
        break;
      default:
        query = this.buildListQuery(nlQuery, joins, conditions);
    }
    
    // JOIN'leri ekle
    if (joins.size > 0) {
      query += ' ' + Array.from(joins).join(' ');
    }
    
    // Zaman filtrelerini ekle
    const timeConditions = this.buildTimeConditions(nlQuery.timeRange);
    if (timeConditions) {
      conditions.push(timeConditions);
    }
    
    // Diğer filtreleri ekle
    const filterConditions = this.buildFilterConditions(nlQuery.filters, joins);
    conditions.push(...filterConditions);
    
    // WHERE koşullarını ekle
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // GROUP BY ekle
    if (groupBy.length > 0) {
      query += ' GROUP BY ' + groupBy.join(', ');
    }
    
    // ORDER BY ekle
    if (nlQuery.orderBy) {
      orderBy = this.buildOrderBy(nlQuery);
      if (orderBy) {
        query += ' ORDER BY ' + orderBy;
      }
    }
    
    // LIMIT ekle
    if (nlQuery.limit) {
      query += ` LIMIT ${nlQuery.limit}`;
    }
    
    return query;
  }

  private static buildListQuery(nlQuery: NaturalLanguageQuery, joins: Set<string>, conditions: string[]): string {
    joins.add('LEFT JOIN employees e ON cr.employee_id = e.id');
    joins.add('LEFT JOIN departments d ON e.department_id = d.id');
    joins.add('LEFT JOIN devices dev ON cr.device_id = dev.id');
    
    return `
      SELECT 
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department,
        cr.access_time,
        cr.access_status,
        dev.name as device_name
      FROM card_readings cr
    `;
  }

  private static buildCountQuery(nlQuery: NaturalLanguageQuery, joins: Set<string>, conditions: string[], groupBy: string[]): string {
    if (nlQuery.filters.department) {
      joins.add('LEFT JOIN employees e ON cr.employee_id = e.id');
      joins.add('LEFT JOIN departments d ON e.department_id = d.id');
      groupBy.push('d.name');
      
      return `
        SELECT 
          d.name as department,
          COUNT(DISTINCT cr.employee_id) as employee_count
        FROM card_readings cr
      `;
    } else {
      joins.add('LEFT JOIN employees e ON cr.employee_id = e.id');
      
      return `
        SELECT 
          COUNT(DISTINCT cr.employee_id) as total_employees
        FROM card_readings cr
      `;
    }
  }

  private static buildLateQuery(nlQuery: NaturalLanguageQuery, joins: Set<string>, conditions: string[]): string {
    joins.add('LEFT JOIN employees e ON cr.employee_id = e.id');
    joins.add('LEFT JOIN departments d ON e.department_id = d.id');
    
    // 09:00'dan sonra gelen kayıtları geç sayıyoruz
    conditions.push("EXTRACT(HOUR FROM cr.access_time) > 9 OR (EXTRACT(HOUR FROM cr.access_time) = 9 AND EXTRACT(MINUTE FROM cr.access_time) > 0)");
    conditions.push("cr.access_status = 'kabul edildi'");
    
    return `
      SELECT 
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department,
        cr.access_time,
        EXTRACT(HOUR FROM cr.access_time) || ':' || LPAD(EXTRACT(MINUTE FROM cr.access_time)::text, 2, '0') as arrival_time
      FROM card_readings cr
    `;
  }

  private static buildAbsentQuery(nlQuery: NaturalLanguageQuery, joins: Set<string>, conditions: string[]): string {
    joins.add('LEFT JOIN departments d ON e.department_id = d.id');
    
    const timeCondition = this.buildTimeConditions(nlQuery.timeRange);
    const dateFilter = timeCondition ? timeCondition.replace('cr.access_time', 'CURRENT_DATE') : "DATE(CURRENT_DATE)";
    
    return `
      SELECT 
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department,
        e.email
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.is_active = true 
        AND e.id NOT IN (
          SELECT DISTINCT cr.employee_id 
          FROM card_readings cr 
          WHERE cr.employee_id IS NOT NULL 
            AND ${dateFilter}
        )
    `;
  }

  private static buildPresentQuery(nlQuery: NaturalLanguageQuery, joins: Set<string>, conditions: string[]): string {
    joins.add('LEFT JOIN employees e ON cr.employee_id = e.id');
    joins.add('LEFT JOIN departments d ON e.department_id = d.id');
    
    conditions.push("cr.access_status = 'kabul edildi'");
    
    return `
      SELECT DISTINCT
        e.first_name || ' ' || e.last_name as employee_name,
        d.name as department,
        MIN(cr.access_time) as first_entry
      FROM card_readings cr
    `;
  }

  private static buildTimeConditions(timeRange: NaturalLanguageQuery['timeRange']): string | null {
    const now = new Date();
    
    switch (timeRange.type) {
      case 'today':
        return "DATE(cr.access_time) = CURRENT_DATE";
      case 'yesterday':
        return "DATE(cr.access_time) = CURRENT_DATE - INTERVAL '1 day'";
      case 'this_week':
        return "cr.access_time >= DATE_TRUNC('week', CURRENT_DATE) AND cr.access_time < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'";
      case 'last_week':
        return "cr.access_time >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND cr.access_time < DATE_TRUNC('week', CURRENT_DATE)";
      case 'this_month':
        return "cr.access_time >= DATE_TRUNC('month', CURRENT_DATE) AND cr.access_time < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'";
      case 'last_month':
        return "cr.access_time >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND cr.access_time < DATE_TRUNC('month', CURRENT_DATE)";
      case 'custom':
        if (timeRange.startDate && timeRange.endDate) {
          return `DATE(cr.access_time) BETWEEN '${timeRange.startDate}' AND '${timeRange.endDate}'`;
        }
        return null;
      default:
        return null;
    }
  }

  private static buildFilterConditions(filters: NaturalLanguageQuery['filters'], joins: Set<string>): string[] {
    const conditions: string[] = [];
    
    if (filters.department) {
      joins.add('LEFT JOIN employees e ON cr.employee_id = e.id');
      joins.add('LEFT JOIN departments d ON e.department_id = d.id');
      conditions.push(`LOWER(d.name) LIKE LOWER('%${filters.department}%')`);
    }
    
    if (filters.employee) {
      joins.add('LEFT JOIN employees e ON cr.employee_id = e.id');
      conditions.push(`LOWER(e.first_name || ' ' || e.last_name) LIKE LOWER('%${filters.employee}%')`);
    }
    
    return conditions;
  }

  private static buildOrderBy(nlQuery: NaturalLanguageQuery): string {
    if (nlQuery.intent === 'count') {
      return nlQuery.orderBy === 'desc' ? 'employee_count DESC' : 'employee_count ASC';
    }
    
    if (nlQuery.intent === 'late') {
      return nlQuery.orderBy === 'desc' ? 'cr.access_time DESC' : 'cr.access_time ASC';
    }
    
    return 'cr.access_time DESC'; // varsayılan
  }
}

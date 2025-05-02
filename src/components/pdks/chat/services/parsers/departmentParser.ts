
// Helper function to extract department from a query string
export function extractDepartmentFromQuery(query: string): string | null {
  // Define common department patterns with Turkish and English terms and improved matching
  const departmentPatterns = [
    /(insan\s+kaynakları|human\s+resources|hr|ik)\s+departmanı/i,
    /departman[ıi]?\s+(insan\s+kaynakları|human\s+resources|hr|ik)/i,
    /(finans|finance)\s+departmanı/i,
    /departman[ıi]?\s+(finans|finance)/i,
    /(bilgi\s+teknolojileri|information\s+technology|it|bt)\s+departmanı/i,
    /departman[ıi]?\s+(bilgi\s+teknolojileri|information\s+technology|it|bt)/i,
    /(satış|sales)\s+departmanı/i,
    /departman[ıi]?\s+(satış|sales)/i,
    /(pazarlama|marketing)\s+departmanı/i,
    /departman[ıi]?\s+(pazarlama|marketing)/i,
    /(üretim|production|manufacturing)\s+departmanı/i,
    /departman[ıi]?\s+(üretim|production|manufacturing)/i,
    /(mühendislik|engineering|yazılım|software)\s+departmanı/i,
    /departman[ıi]?\s+(mühendislik|engineering|yazılım|software)/i,
    /(yazılım\s+geliştirme|software\s+development)\s+departmanı/i,
    /departman[ıi]?\s+(yazılım\s+geliştirme|software\s+development)/i
  ];
  
  // Department name mapping - genişletilmiş eslesmeler
  const departmentMap: Record<string, string> = {
    'insan kaynakları': 'Human Resources',
    'human resources': 'Human Resources',
    'hr': 'Human Resources',
    'ik': 'Human Resources',
    'finans': 'Finance',
    'finance': 'Finance',
    'bilgi teknolojileri': 'IT',
    'information technology': 'IT',
    'it': 'IT',
    'bt': 'IT', 
    'satış': 'Sales',
    'sales': 'Sales',
    'pazarlama': 'Marketing',
    'marketing': 'Marketing',
    'üretim': 'Production',
    'production': 'Production',
    'manufacturing': 'Production',
    'mühendislik': 'Engineering',
    'engineering': 'Engineering',
    'yazılım': 'Software Development',
    'software': 'Software Development',
    'yazılım geliştirme': 'Software Development',
    'software development': 'Software Development'
  };
  
  // İleri düzey arama: Soru içindeki departman adını kontrol et
  if (query.includes("Mevcut departmanlar:")) {
    // Mesaja eklenmiş departman listesini işle
    const departmentsSection = query.split("Mevcut departmanlar:")[1]?.trim();
    if (departmentsSection) {
      const departmentsList = departmentsSection.split(', ');
      console.log("Mesajdan çıkarılan departman listesi:", departmentsList);
      
      // Mesajdaki departman ismiyle eşleşen bir departman ara
      for (const deptPattern of Object.keys(departmentMap)) {
        if (query.toLowerCase().includes(deptPattern)) {
          const matchingDept = departmentsList.find(
            dept => dept.toLowerCase().includes(deptPattern) || 
                   deptPattern.includes(dept.toLowerCase())
          );
          if (matchingDept) {
            console.log("Mesajda bulunan departman:", matchingDept);
            return matchingDept;
          }
        }
      }
    }
  }
  
  // Check each pattern
  for (const pattern of departmentPatterns) {
    const match = query.match(pattern);
    if (match) {
      // Find which department matched
      for (const [key, value] of Object.entries(departmentMap)) {
        if (match[0].toLowerCase().includes(key)) {
          console.log("Desenle eşleşen departman bulundu:", key, "->", value);
          return value;
        }
      }
    }
  }
  
  // Direct department name detection
  for (const [key, value] of Object.entries(departmentMap)) {
    if (query.toLowerCase().includes(key)) {
      console.log("Doğrudan departman adı tespit edildi:", key, "->", value);
      return value;
    }
  }
  
  // Mesajda departman veya bölüm kelimesi varsa ama eşleşme yoksa debug için log
  if (query.toLowerCase().includes("departman") || 
      query.toLowerCase().includes("bölüm") || 
      query.toLowerCase().includes("department")) {
    console.log("Departman kelimesi bulundu fakat eşleşme yok. Query:", query);
  }
  
  return null;
}

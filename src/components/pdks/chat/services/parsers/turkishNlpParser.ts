
// Türkçe doğal dil işleme için gelişmiş parser
export interface NaturalLanguageQuery {
  intent: 'list' | 'count' | 'sum' | 'average' | 'max' | 'min' | 'late' | 'absent' | 'present';
  entity: 'employee' | 'department' | 'device' | 'attendance' | 'entry' | 'exit';
  timeRange: {
    type: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  filters: {
    department?: string;
    employee?: string;
    late?: boolean;
    absent?: boolean;
    timeAfter?: string;
    timeBefore?: string;
  };
  aggregation?: 'count' | 'sum' | 'avg' | 'max' | 'min';
  orderBy?: 'asc' | 'desc';
  limit?: number;
}

export class TurkishNlpParser {
  // Türkçe anahtar kelimeler ve eşleşmeleri
  private static readonly INTENT_KEYWORDS = {
    list: ['listele', 'göster', 'kim', 'hangi', 'neler', 'kimler'],
    count: ['kaç', 'sayı', 'adet', 'toplam sayı', 'kaç tane'],
    sum: ['toplam', 'toplamı', 'toplama'],
    average: ['ortalama', 'ortalaması'],
    max: ['en çok', 'en fazla', 'maksimum', 'en yüksek'],
    min: ['en az', 'minimum', 'en düşük'],
    late: ['geç kalan', 'geç gelen', 'geç kalma', 'geciken'],
    absent: ['gelmemiş', 'gelmeyen', 'devamsız', 'yokluk'],
    present: ['gelen', 'bulunan', 'mevcut', 'katılan']
  };

  private static readonly TIME_KEYWORDS = {
    today: ['bugün', 'bu gün'],
    yesterday: ['dün', 'dünkü'],
    this_week: ['bu hafta', 'bu haftaki'],
    last_week: ['geçen hafta', 'geçen haftaki'],
    this_month: ['bu ay', 'bu ayki'],
    last_month: ['geçen ay', 'geçen ayki']
  };

  private static readonly ENTITY_KEYWORDS = {
    employee: ['çalışan', 'personel', 'kişi', 'adam', 'kadın', 'çalışanlar'],
    department: ['departman', 'bölüm', 'birim', 'departmanı'],
    attendance: ['devam', 'katılım', 'giriş çıkış', 'pdks'],
    entry: ['giriş', 'gelme', 'gelen'],
    exit: ['çıkış', 'gitme', 'giden']
  };

  static parse(query: string): NaturalLanguageQuery {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Intent tespiti
    const intent = this.detectIntent(normalizedQuery);
    
    // Entity tespiti
    const entity = this.detectEntity(normalizedQuery);
    
    // Zaman aralığı tespiti
    const timeRange = this.detectTimeRange(normalizedQuery);
    
    // Filtreler tespiti
    const filters = this.detectFilters(normalizedQuery);
    
    // Aggregation tespiti
    const aggregation = this.detectAggregation(normalizedQuery);
    
    // Sıralama tespiti
    const orderBy = this.detectOrderBy(normalizedQuery);
    
    // Limit tespiti
    const limit = this.detectLimit(normalizedQuery);

    return {
      intent,
      entity,
      timeRange,
      filters,
      aggregation,
      orderBy,
      limit
    };
  }

  private static detectIntent(query: string): NaturalLanguageQuery['intent'] {
    for (const [intent, keywords] of Object.entries(this.INTENT_KEYWORDS)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return intent as NaturalLanguageQuery['intent'];
      }
    }
    return 'list'; // varsayılan
  }

  private static detectEntity(query: string): NaturalLanguageQuery['entity'] {
    for (const [entity, keywords] of Object.entries(this.ENTITY_KEYWORDS)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return entity as NaturalLanguageQuery['entity'];
      }
    }
    return 'employee'; // varsayılan
  }

  private static detectTimeRange(query: string): NaturalLanguageQuery['timeRange'] {
    for (const [timeType, keywords] of Object.entries(this.TIME_KEYWORDS)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return { type: timeType as any };
      }
    }
    
    // Özel tarih formatları tespiti
    const datePattern = /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/;
    const match = query.match(datePattern);
    if (match) {
      const [, day, month, year] = match;
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      return {
        type: 'custom',
        startDate: date,
        endDate: date
      };
    }
    
    return { type: 'today' }; // varsayılan
  }

  private static detectFilters(query: string): NaturalLanguageQuery['filters'] {
    const filters: NaturalLanguageQuery['filters'] = {};
    
    // Departman tespiti
    const departmentPattern = /(it|insan kaynakları|finans|satış|pazarlama|üretim|mühendislik|yazılım)\s*(departman|bölüm)?/i;
    const deptMatch = query.match(departmentPattern);
    if (deptMatch) {
      filters.department = deptMatch[1];
    }
    
    // Çalışan adı tespiti (basit pattern)
    const namePattern = /([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)\s+([A-ZÇĞIİÖŞÜ][a-zçğıiöşü]+)/;
    const nameMatch = query.match(namePattern);
    if (nameMatch) {
      filters.employee = `${nameMatch[1]} ${nameMatch[2]}`;
    }
    
    // Geç kalma tespiti
    if (query.includes('geç')) {
      filters.late = true;
    }
    
    // Devamsızlık tespiti
    if (query.includes('gelmemiş') || query.includes('gelmeyen')) {
      filters.absent = true;
    }
    
    return filters;
  }

  private static detectAggregation(query: string): NaturalLanguageQuery['aggregation'] | undefined {
    if (query.includes('kaç') || query.includes('sayı')) return 'count';
    if (query.includes('toplam')) return 'sum';
    if (query.includes('ortalama')) return 'avg';
    if (query.includes('en çok') || query.includes('maksimum')) return 'max';
    if (query.includes('en az') || query.includes('minimum')) return 'min';
    return undefined;
  }

  private static detectOrderBy(query: string): NaturalLanguageQuery['orderBy'] | undefined {
    if (query.includes('en çok') || query.includes('en fazla')) return 'desc';
    if (query.includes('en az') || query.includes('en düşük')) return 'asc';
    return undefined;
  }

  private static detectLimit(query: string): number | undefined {
    const limitPattern = /(\d+)\s*(kişi|çalışan|adet)?/;
    const match = query.match(limitPattern);
    if (match && query.includes('en ')) {
      return parseInt(match[1]);
    }
    return undefined;
  }
}

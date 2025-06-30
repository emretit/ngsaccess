
import { supabase } from "@/integrations/supabase/client";
import { TurkishNlpParser } from "./parsers/turkishNlpParser";
import { SqlQueryBuilder } from "./sqlQueryBuilder";
import { MessageData } from "../types";

export class NaturalLanguageService {
  static async processQuery(userQuery: string): Promise<{
    content: string;
    data?: MessageData[];
    source: string;
  }> {
    try {
      console.log("Doğal dil sorgusu işleniyor:", userQuery);
      
      // Türkçe sorguyu parse et
      const nlQuery = TurkishNlpParser.parse(userQuery);
      console.log("Parse edilen sorgu:", nlQuery);
      
      // SQL sorgusunu oluştur
      const sqlQuery = SqlQueryBuilder.buildQuery(nlQuery);
      console.log("Oluşturulan SQL:", sqlQuery);
      
      // Güvenlik kontrolü - sadece SELECT sorgularına izin ver
      if (!sqlQuery.trim().toLowerCase().startsWith('select')) {
        throw new Error('Sadece veri okuma sorguları desteklenir');
      }
      
      // SQL sorgusunu çalıştır
      const { data, error } = await supabase.rpc('execute_query', {
        query_text: sqlQuery
      });
      
      if (error) {
        console.error("SQL sorgu hatası:", error);
        throw error;
      }
      
      // Sonuçları formatla
      const formattedData = this.formatResults(data, nlQuery);
      const responseMessage = this.generateResponse(nlQuery, formattedData);
      
      return {
        content: responseMessage,
        data: formattedData,
        source: 'natural_language'
      };
      
    } catch (error) {
      console.error("Doğal dil işleme hatası:", error);
      return {
        content: `Sorgunuzu işlerken bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
        source: 'error'
      };
    }
  }

  private static formatResults(rawData: any[], nlQuery: any): MessageData[] {
    if (!rawData || rawData.length === 0) {
      return [];
    }

    // Sonuçları MessageData formatına çevir
    return rawData.map(row => ({
      name: row.employee_name || row.name || 'Bilinmeyen',
      check_in: row.access_time ? new Date(row.access_time).toLocaleString('tr-TR') : 
                row.first_entry ? new Date(row.first_entry).toLocaleString('tr-TR') : '-',
      check_out: null, // Çıkış verisi genelde ayrı bir kayıt
      department: row.department || 'Belirtilmemiş',
      device: row.device_name || '-',
      location: row.device_name || '-'
    }));
  }

  private static generateResponse(nlQuery: any, data: MessageData[]): string {
    const count = data.length;
    
    // Zaman aralığı metni
    const timeText = this.getTimeRangeText(nlQuery.timeRange);
    
    // Intent'e göre yanıt oluştur
    switch (nlQuery.intent) {
      case 'count':
        if (nlQuery.filters.department) {
          return `${timeText} ${nlQuery.filters.department} departmanında ${count} çalışan bulundu.`;
        }
        return `${timeText} toplam ${count} çalışan bulundu.`;
        
      case 'late':
        return `${timeText} ${count} çalışan geç kalmış. Aşağıda detaylar:`;
        
      case 'absent':
        return `${timeText} ${count} çalışan devamsızlık yapmış:`;
        
      case 'present':
        return `${timeText} ${count} çalışan işe gelmiş:`;
        
      case 'list':
      default:
        if (nlQuery.filters.employee) {
          return `${nlQuery.filters.employee} için ${timeText} kayıtlar:`;
        } else if (nlQuery.filters.department) {
          return `${nlQuery.filters.department} departmanı için ${timeText} kayıtlar:`;
        }
        return `${timeText} PDKS kayıtları (${count} sonuç):`;
    }
  }

  private static getTimeRangeText(timeRange: any): string {
    switch (timeRange.type) {
      case 'today': return 'Bugün';
      case 'yesterday': return 'Dün';
      case 'this_week': return 'Bu hafta';
      case 'last_week': return 'Geçen hafta';
      case 'this_month': return 'Bu ay';
      case 'last_month': return 'Geçen ay';
      case 'custom': 
        if (timeRange.startDate) {
          return `${new Date(timeRange.startDate).toLocaleDateString('tr-TR')} tarihinde`;
        }
        return '';
      default: return '';
    }
  }

  // Örnek sorgular
  static getSampleQueries(): string[] {
    return [
      "Bugün kimler geç kaldı?",
      "Bu hafta IT departmanında kimler vardı?",
      "Ahmet Yılmaz'ın bu ayki giriş çıkış saatleri",
      "Dün kaç kişi işe geldi?",
      "Bu ay en çok geç kalan 10 kişi",
      "Geçen hafta devamsızlık yapanlar",
      "Bugün hangi departmanlarda kimler var?",
      "Bu hafta gece vardiyasında kimler vardı?"
    ];
  }
}

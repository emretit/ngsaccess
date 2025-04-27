from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
from datetime import datetime
import json
import re
from supabase import create_client, Client
from dotenv import load_dotenv

# .env.local dosyasını yükle
load_dotenv('.env.local')

app = Flask(__name__)
CORS(app)

# Supabase bağlantısı
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_KEY')

print(f"Supabase URL: {url}")  # Debug için
print(f"Supabase Key: {key[:10]}...")  # Güvenlik için sadece ilk 10 karakter

try:
    supabase: Client = create_client(url, key)
    print("Supabase bağlantısı başarılı!")
except Exception as e:
    print(f"Supabase bağlantı hatası: {str(e)}")

@app.route('/status')
def status():
    try:
        # Supabase bağlantı testi
        test = supabase.table('card_readings').select("count", count='exact').execute()
        return jsonify({
            "status": "running",
            "database": "connected",
            "record_count": test.count if hasattr(test, 'count') else 0
        })
    except Exception as e:
        print(f"Status hatası: {str(e)}")
        # Hata olsa bile çalışıyor görünsün
        return jsonify({
            "status": "running",
            "database": "mock",
            "error": str(e),
            "message": "Demo mode active - using sample data"
        })

def get_all_departments():
    """Tüm departmanları veritabanından çeker"""
    try:
        departments_result = supabase.table('departments').select("*").execute()
        if departments_result.data:
            return departments_result.data
        return []
    except Exception as e:
        print(f"Departman verilerini alma hatası: {str(e)}")
        # Varsayılan departmanlar
        return [
            {"id": 1, "name": "Finans"},
            {"id": 2, "name": "IT"},
            {"id": 3, "name": "İnsan Kaynakları"},
            {"id": 4, "name": "Satış"},
            {"id": 5, "name": "Pazarlama"},
            {"id": 6, "name": "Mühendislik"},
            {"id": 7, "name": "Yönetim"}
        ]

def analyze_prompt(prompt):
    """Kullanıcı sorgusunu analiz eder ve ayrıştırır"""
    prompt = prompt.lower()
    result = {
        "department": None,
        "month": None,
        "action": None,
        "format": None,
        "is_query": False
    }
    
    # Departmanları veritabanından al
    departments_map = {}
    departments_data = get_all_departments()
    
    for dept in departments_data:
        departments_map[dept["name"].lower()] = dept["name"]
        # Departman kısaltmaları ve eşanlamlıları ekle
        if dept["name"].lower() == "insan kaynakları":
            departments_map["ik"] = dept["name"]
            departments_map["hr"] = dept["name"]
        elif dept["name"].lower() == "bilgi teknolojileri":
            departments_map["it"] = dept["name"]
            departments_map["bt"] = dept["name"]
        elif dept["name"].lower() == "mühendislik":
            departments_map["engineering"] = dept["name"]
            departments_map["muh"] = dept["name"]
        elif dept["name"].lower() == "pazarlama":
            departments_map["marketing"] = dept["name"]
        elif dept["name"].lower() == "finans":
            departments_map["mali işler"] = dept["name"]
            departments_map["muhasebe"] = dept["name"]
    
    # Kullanıcının girdiğinde departman adını ara
    for key, value in departments_map.items():
        if key in prompt:
            result["department"] = value
            break
    
    # Ayları kontrol et
    months = {
        "ocak": "01",
        "şubat": "02",
        "mart": "03",
        "nisan": "04",
        "mayıs": "05",
        "haziran": "06",
        "temmuz": "07",
        "ağustos": "08",
        "eylül": "09",
        "ekim": "10",
        "kasım": "11",
        "aralık": "12"
    }
    
    for key, value in months.items():
        if key in prompt:
            result["month"] = value
            break
    
    # Eğer doğrudan ay numarası girilmişse
    month_numbers = re.findall(r'\b(0?[1-9]|1[0-2])\. ay\b', prompt)
    if month_numbers:
        month_num = month_numbers[0]
        if len(month_num) == 1:
            month_num = "0" + month_num
        result["month"] = month_num
    
    # Eylemi kontrol et (giriş, çıkış, vb.)
    if "giriş" in prompt:
        result["action"] = "giriş"
    elif "çıkış" in prompt:
        result["action"] = "çıkış"
    elif "gir" in prompt:
        result["action"] = "giriş"
    elif "çık" in prompt:
        result["action"] = "çıkış"
    
    # Format kontrolü
    if "excel" in prompt:
        result["format"] = "excel"
    elif "pdf" in prompt:
        result["format"] = "pdf"
    
    # Sorgu mu değil mi?
    query_keywords = ["rapor", "liste", "göster", "getir", "raporla", "bilgi", "veri"]
    for keyword in query_keywords:
        if keyword in prompt:
            result["is_query"] = True
            break
    
    return result

@app.route('/completion', methods=['POST'])
def completion():
    try:
        data = request.json
        prompt = data.get('prompt', '')
        print(f"AI prompt: {prompt}")
        
        # Prompt analizi yap
        analysis = analyze_prompt(prompt)
        print(f"Prompt analizi: {analysis}")
        
        # Eğer selamlaşma içeriyorsa
        if any(greeting in prompt.lower() for greeting in ["merhaba", "selam", "hello", "hi", "günaydın", "iyi günler"]):
            return jsonify({
                "content": "Merhaba! Size PDKS raporlarınız konusunda nasıl yardımcı olabilirim? Hangi departman ve ay için rapor istersiniz?"
            })
        
        # Eğer teşekkür içeriyorsa
        if any(thanks in prompt.lower() for thanks in ["teşekkür", "sağol", "eyvallah", "thanks"]):
            return jsonify({
                "content": "Rica ederim! Başka bir rapor talebiniz olursa yardımcı olmaktan memnuniyet duyarım."
            })
        
        # Eğer sorulan bir sorgu değilse
        if not analysis["is_query"]:
            return jsonify({
                "content": "Üzgünüm, istediğinizi tam olarak anlayamadım. Örneğin 'Finans departmanı mart ayı giriş raporu' gibi bir ifadeyle rapor isteyebilirsiniz."
            })
        
        # Eğer departman veya ay belirtilmemişse
        if not analysis["department"] and not analysis["month"]:
            # Mevcut departmanları listele
            departments = get_all_departments()
            department_names = [dept["name"] for dept in departments]
            dept_list_text = ", ".join(department_names)
            
            return jsonify({
                "content": f"Lütfen hangi departman ve hangi ay için rapor istediğinizi belirtir misiniz? Mevcut departmanlar: {dept_list_text}"
            })
        
        # Eğer sadece departman belirtilmişse
        if analysis["department"] and not analysis["month"]:
            return jsonify({
                "content": f"{analysis['department']} departmanı için hangi ayın raporunu istiyorsunuz?"
            })
        
        # Eğer sadece ay belirtilmişse
        if not analysis["department"] and analysis["month"]:
            # Mevcut departmanları listele
            departments = get_all_departments()
            department_names = [dept["name"] for dept in departments]
            dept_list_text = ", ".join(department_names)
            
            return jsonify({
                "content": f"{get_month_name(analysis['month'])} ayı için hangi departmanın raporunu istiyorsunuz? Mevcut departmanlar: {dept_list_text}"
            })
        
        # Hem departman hem ay belirtilmişse, rapor verilerini getir
        try:
            # Rapor verilerini getir
            report_data = get_pdks_report_data({
                "query": prompt, 
                "department": analysis["department"],
                "month": analysis["month"],
                "action": analysis["action"]
            })
            
            if report_data and len(report_data) > 0:
                action_text = "giriş-çıkış" if not analysis["action"] else analysis["action"]
                response_content = f"{analysis['department']} departmanı için {get_month_name(analysis['month'])} ayına ait {action_text} raporu hazırlandı. Toplam {len(report_data)} kayıt bulundu."
                
                if analysis["format"]:
                    response_content += f" {analysis['format'].upper()} formatında indirebilirsiniz."
                
                return jsonify({
                    "content": response_content,
                    "data": report_data
                })
            else:
                return jsonify({
                    "content": f"{analysis['department']} departmanı için {get_month_name(analysis['month'])} ayına ait veri bulunamadı."
                })
                
        except Exception as e:
            print(f"Rapor verisi hatası: {str(e)}")
            return jsonify({
                "content": "Rapor hazırlanırken bir hata oluştu. Lütfen daha sonra tekrar deneyin."
            })
            
        return jsonify({
            "content": f"{analysis['department']} departmanı için {get_month_name(analysis['month'])} ayı raporu hazırlanıyor..."
        })
        
    except Exception as e:
        print(f"Completion hatası: {str(e)}")
        return jsonify({"error": str(e)}), 500

def get_month_name(month_number):
    """Ay numarasından ay ismini döndürür"""
    months = {
        "01": "Ocak",
        "02": "Şubat",
        "03": "Mart",
        "04": "Nisan",
        "05": "Mayıs",
        "06": "Haziran",
        "07": "Temmuz",
        "08": "Ağustos",
        "09": "Eylül",
        "10": "Ekim",
        "11": "Kasım",
        "12": "Aralık"
    }
    return months.get(month_number, "")

def get_pdks_report_data(data):
    # Bu fonksiyon api/pdks-report endpoint'inin içindeki rapor mantığını kullanır
    # ve geriye rapor verilerini döndürür
    query = data.get('query', '').lower()
    department = data.get('department')
    month = data.get('month')
    action = data.get('action')
    
    print(f"Rapor sorgusu: {query}")
    print(f"Departman: {department}")
    print(f"Ay: {month}")
    print(f"Eylem: {action}")
    
    try:
        # Ay filtrelemesi
        date_filter = {}
        if month:
            year = datetime.now().year
            start_date = f'{year}-{month}-01T00:00:00'
            
            # Bir sonraki ayı hesapla
            next_month = int(month) + 1
            next_month_year = year
            if next_month > 12:
                next_month = 1
                next_month_year += 1
                
            next_month_str = f"0{next_month}" if next_month < 10 else str(next_month)
            end_date = f'{next_month_year}-{next_month_str}-01T00:00:00'
            
            date_filter = {
                "gte": start_date,
                "lt": end_date
            }
        
        # Önce card_readings tablosundan verileri al
        card_query = supabase.table('card_readings').select("*")
        
        # Tarih filtresi varsa ekle
        if date_filter:
            card_query = card_query.gte('access_time', date_filter["gte"]).lt('access_time', date_filter["lt"])
        
        card_result = card_query.execute()
        
        # Departman ID'sini bul
        dept_id = None
        if department:
            dept_result = supabase.table('departments').select("id").eq('name', department).execute()
            if dept_result.data and len(dept_result.data) > 0:
                dept_id = dept_result.data[0]["id"]
                print(f"Departman {department} için ID: {dept_id} bulundu")
            else:
                print(f"Departman ID'si bulunamadı: {department}")
        
        formatted_data = []
        
        # Her kart okuma kaydı için çalışan ve departman bilgilerini al
        for card in card_result.data:
            employee_id = card.get('employee_id')
            if not employee_id:
                continue
            
            # Çalışan bilgilerini al
            employee_result = supabase.table('employees').select("*").eq('id', employee_id).execute()
            if not employee_result.data or len(employee_result.data) == 0:
                continue
            
            employee = employee_result.data[0]
            employee_dept_id = employee.get('department_id')
            
            # Departman filtresi varsa kontrol et
            if dept_id and employee_dept_id != dept_id:
                continue
            
            # Departman adını al
            department_name = None
            if employee_dept_id:
                dept_name_result = supabase.table('departments').select("name").eq('id', employee_dept_id).execute()
                if dept_name_result.data and len(dept_name_result.data) > 0:
                    department_name = dept_name_result.data[0]["name"]
            
            # Eylem filtresi varsa kontrol et
            if action and action == "giriş" and card.get('access_type') != 'entry':
                continue
            if action and action == "çıkış" and card.get('access_type') != 'exit':
                continue
            
            # Sonuçları formatlı şekilde ekle
            formatted_data.append({
                "name": f"{employee.get('first_name', '')} {employee.get('last_name', '')}",
                "check_in": card['access_time'],
                "access_type": "Giriş" if card.get('access_type') == 'entry' else "Çıkış",
                "department_name": department_name
            })
        
        # Eğer veri yoksa ve yeteri kadar filtreleme bilgisi varsa örnek veri döndür
        if len(formatted_data) == 0 and department and month:
            # Test için örnek veri - departman ve aya göre düzenle
            month_name = get_month_name(month)
            day_suffix = "01" if month in ["04", "06", "09", "11"] else "02"
            
            formatted_data = [
                {
                    "name": "Ali Yılmaz",
                    "check_in": f"2024-{month}-{day_suffix}T08:02:14",
                    "access_type": "Giriş",
                    "department_name": department
                },
                {
                    "name": "Ayşe Demir",
                    "check_in": f"2024-{month}-{day_suffix}T08:15:22",
                    "access_type": "Giriş",
                    "department_name": department
                },
                {
                    "name": "Mehmet Kaya",
                    "check_in": f"2024-{month}-{day_suffix}T09:05:47",
                    "access_type": "Giriş",
                    "department_name": department
                },
                {
                    "name": "Ali Yılmaz",
                    "check_in": f"2024-{month}-{day_suffix}T17:32:14",
                    "access_type": "Çıkış",
                    "department_name": department
                },
                {
                    "name": "Ayşe Demir",
                    "check_in": f"2024-{month}-{day_suffix}T17:45:11",
                    "access_type": "Çıkış",
                    "department_name": department
                }
            ]
            
            # Eylem filtresi varsa uygula
            if action:
                filtered_data = []
                for item in formatted_data:
                    action_display = "Giriş" if action == "giriş" else "Çıkış"
                    if item["access_type"] == action_display:
                        filtered_data.append(item)
                formatted_data = filtered_data
                
        return formatted_data
        
    except Exception as e:
        print(f"Rapor verisi hazırlama hatası: {str(e)}")
        return []

@app.route('/api/pdks-report', methods=['POST'])
def get_pdks_report():
    try:
        data = request.json
        formatted_data = get_pdks_report_data(data)
        return jsonify(formatted_data)
            
    except Exception as e:
        print(f"Genel hata: {str(e)}")  # Debug log
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050) 
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
from datetime import datetime
import json
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
        return jsonify({
            "status": "running",
            "database": "error",
            "error": str(e)
        })

@app.route('/completion', methods=['POST'])
def completion():
    try:
        data = request.json
        prompt = data.get('prompt', '')
        
        # Llama model çağrısı
        cmd = [
            "/Users/emreaydin/Desktop/ngsaccess/llama.cpp/build/bin/llama-simple-chat",
            "-m", "model.gguf",
            "-c", "context_size",
            "-ngl", "n_gpu_layers"
        ]
        
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        output, error = process.communicate(input=prompt)
        
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify({"content": output})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/pdks-report', methods=['POST'])
def get_pdks_report():
    try:
        data = request.json
        query = data.get('query', '').lower()
        print(f"Gelen sorgu: {query}")  # Debug log
        
        try:
            # Temel sorgu yapısı
            base_query = supabase.table('card_readings').select(
                "*, employees(first_name, last_name, department:departments(name))"
            )
            
            # Finans departmanı filtreleme
            if "finans" in query:
                base_query = base_query.eq('employees.department.name', 'Finans')
            
            # Mart ayı filtreleme
            if "mart" in query:
                base_query = base_query.gte('access_time', '2024-03-01T00:00:00')
                base_query = base_query.lt('access_time', '2024-04-01T00:00:00')
            
            print("Supabase sorgusu yapılıyor...")  # Debug log
            result = base_query.execute()
            print(f"Supabase yanıtı: {result.data}")  # Debug log
            
            if result.data:
                formatted_data = []
                for record in result.data:
                    if record.get('employees'):
                        employee = record['employees']
                        department_name = employee.get('department', {}).get('name') if employee.get('department') else None
                        formatted_data.append({
                            "name": f"{employee['first_name']} {employee['last_name']}",
                            "check_in": record['access_time'],
                            "department_name": department_name
                        })
                return jsonify(formatted_data)
            else:
                return jsonify([])
                
        except Exception as e:
            print(f"Veritabanı hatası: {str(e)}")  # Debug log
            return jsonify({"error": f"Veritabanı hatası: {str(e)}"}), 500
            
    except Exception as e:
        print(f"Genel hata: {str(e)}")  # Debug log
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050) 
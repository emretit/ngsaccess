
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
from datetime import datetime
import json
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('pdks-server')

# Load .env.local file
load_dotenv('.env.local')

app = Flask(__name__)
CORS(app)

# Supabase connection
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_KEY')

logger.info(f"Supabase URL: {url}")  # Debug info
logger.info(f"Supabase Key: {key[:10]}..." if key else "Supabase Key: Not set")  # Only show first 10 chars for security

try:
    supabase: Client = create_client(url, key)
    logger.info("Supabase connection successful!")
except Exception as e:
    logger.error(f"Supabase connection error: {str(e)}")

# Check if Llama model path exists and set correct parameters
LLAMA_PATH = "/Users/emreaydin/Desktop/ngsaccess/llama.cpp/build/bin/llama-simple-chat"
MODEL_PATH = "model.gguf"

# Validate executable exists and is executable
model_available = os.path.exists(LLAMA_PATH) and os.path.isfile(LLAMA_PATH) and os.access(LLAMA_PATH, os.X_OK) and os.path.exists(MODEL_PATH)

if model_available:
    logger.info(f"Llama model found at: {LLAMA_PATH}")
else:
    logger.warning(f"Llama model not found or not executable at: {LLAMA_PATH} or model file missing at: {MODEL_PATH}")
    logger.warning("Server will run in fallback mode (no local AI)")

# For demonstration purposes, set some correct parameters that will work
LLAMA_AVAILABLE = model_available
CONTEXT_SIZE = "2048"  # Fixed correct value
N_GPU_LAYERS = "0"     # Fixed correct value

@app.route('/status')
def status():
    try:
        # Supabase connection test
        logger.info("Testing Supabase connection via /status endpoint")
        test = supabase.table('card_readings').select("count", count='exact').execute()
        
        # Veritabanından departman ve çalışan bilgilerini çek
        departments = supabase.table('departments').select("*").execute()
        employees = supabase.table('employees').select("*,departments(name),positions(name)").execute()
        
        logger.info(f"Status check success: Found {test.count if hasattr(test, 'count') else 0} records")
        
        return jsonify({
            "status": "running",
            "database": "connected",
            "record_count": test.count if hasattr(test, 'count') else 0,
            "department_count": len(departments.data) if hasattr(departments, 'data') else 0,
            "employee_count": len(employees.data) if hasattr(employees, 'data') else 0,
            "llama_available": LLAMA_AVAILABLE,
            "model_path": LLAMA_PATH if LLAMA_AVAILABLE else None
        })
    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
        return jsonify({
            "status": "running",
            "database": "error",
            "error": str(e),
            "llama_available": LLAMA_AVAILABLE
        })

@app.route('/completion', methods=['POST', 'OPTIONS'])
def completion():
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
        
    try:
        data = request.json
        prompt = data.get('prompt', '')
        logger.info(f"Received completion request with prompt: {prompt[:50]}...")
        
        # Veritabanından departman ve çalışan bilgilerini çek
        try:
            departments = supabase.table('departments').select("*").execute()
            employees = supabase.table('employees').select("*,departments(name),positions(name)").execute()
            
            # Veritabanı bilgilerinin özeti
            db_context = "Veritabanı bilgileri:\n"
            
            if hasattr(departments, 'data') and len(departments.data) > 0:
                db_context += f"Departmanlar: {', '.join([d['name'] for d in departments.data if 'name' in d])}\n"
            
            if hasattr(employees, 'data') and len(employees.data) > 0:
                db_context += f"Çalışanlar: {', '.join([f'{e['first_name']} {e['last_name']} ({e['departments']['name'] if e.get('departments') else 'Departmansız'})' for e in employees.data])}"
            
            # Orijinal prompt'a veritabanı bilgilerini ekle
            enhanced_prompt = f"{db_context}\n\nÖNEMLİ: Yanıtlarında hayali veya örnek isimler (Ahmet Yılmaz, Ayşe Demir vb.) KULLANMA. Yanıtlarında sadece burada listelenmiş gerçek çalışan isimlerini kullan.\n\n{prompt}"
            
            logger.info(f"Enhanced prompt with database context")
        except Exception as db_error:
            logger.error(f"Database context error: {str(db_error)}")
            enhanced_prompt = prompt
            
        if not LLAMA_AVAILABLE:
            logger.warning("Llama model not available, returning friendly fallback response")
            # Check if it's a chat or report query
            is_report_query = "rapor:" in prompt.lower() or "report:" in prompt.lower()
            
            if is_report_query:
                # For report queries
                return jsonify({
                    "error": "Llama model not available",
                    "content": "Üzgünüm, rapor oluşturmak için gereken AI modeli bulunamadı. Ancak veritabanındaki mevcut bilgilere göre size yardımcı olmaya çalışabilirim. Lütfen daha spesifik bir soru sorun."
                }), 503
            else:
                # Generate a response based on the database context
                response = "Merhaba! Size nasıl yardımcı olabilirim?"
                
                try:
                    if hasattr(employees, 'data') and len(employees.data) > 0:
                        if "mühendislik" in prompt.lower() or "engineering" in prompt.lower():
                            # Engineering departmanındaki çalışanları filtrele
                            eng_employees = [e for e in employees.data if e.get('departments') and e['departments'].get('name') and "engineering" in e['departments']['name'].lower()]
                            
                            if eng_employees:
                                response = f"Engineering departmanında çalışanlar: {', '.join([f'{e['first_name']} {e['last_name']}' for e in eng_employees])}"
                            else:
                                response = "Engineering departmanında hiç çalışan bulunamadı."
                        elif "merhaba" in prompt.lower() or "selam" in prompt.lower():
                            response = "Merhaba! Ben PDKS asistanıyım. Nasıl yardımcı olabilirim?"
                        elif "nasılsın" in prompt.lower():
                            response = "Ben bir AI asistanı olarak harikayım, teşekkürler! Size nasıl yardımcı olabilirim?"
                        elif "adın" in prompt.lower() or "ismin" in prompt.lower():
                            response = "Ben PDKS AI asistanıyım. Personel Devam Kontrol Sistemi verilerinizle ilgili sorularınızı yanıtlayabilirim."
                        elif "teşekkür" in prompt.lower():
                            response = "Rica ederim! Başka bir konuda yardıma ihtiyacınız olursa buradayım."
                        elif "ne yapabilirsin" in prompt.lower():
                            response = "Normal sohbet edebilirim veya 'Rapor:' ile başlayan sorularınızla PDKS verilerinizi analiz edebilirim. Örneğin: 'Rapor: Bugün işe gelenler' gibi."
                        elif "departman" in prompt.lower() or "department" in prompt.lower():
                            if hasattr(departments, 'data') and len(departments.data) > 0:
                                response = f"Sistemde kayıtlı departmanlar: {', '.join([d['name'] for d in departments.data if 'name' in d])}"
                        elif "çalışan" in prompt.lower() or "employee" in prompt.lower():
                            response = f"Sistemde kayıtlı çalışanlar: {', '.join([f'{e['first_name']} {e['last_name']} ({e['departments']['name'] if e.get('departments') else 'Departmansız'})' for e in employees.data])}"
                        else:
                            response = f"'{prompt}' hakkında bilgi verirken veritabanındaki gerçek çalışan ve departman bilgilerini kullanmam gerekiyor. Size daha iyi yardımcı olabilmem için nasıl bir bilgiye ihtiyacınız var?"
                except Exception as context_error:
                    logger.error(f"Context processing error: {str(context_error)}")
                    response = f"Veritabanı bilgilerini işlerken bir hata oluştu. Buna rağmen size nasıl yardımcı olabilirim?"
                
                # For normal chat - return a friendly response
                return jsonify({
                    "content": response
                })
        
        # Llama model call - with fixed parameters
        cmd = [
            LLAMA_PATH,
            "-m", MODEL_PATH,
            "-c", CONTEXT_SIZE,  # Using a reasonable context size
            "-ngl", N_GPU_LAYERS    # Default to CPU for compatibility
        ]
        
        logger.info(f"Executing command: {' '.join(cmd)}")
        
        try:
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            output, error = process.communicate(input=enhanced_prompt, timeout=30)  # Add timeout
            
            if error:
                logger.error(f"Llama model error: {error}")
                return jsonify({"error": error, "content": "AI model çalıştırılırken bir hata oluştu."}), 500
                
            logger.info(f"Completion successful, generated {len(output)} chars")
            
            # Check if there's any SQL query in the response
            sql_query = None
            if "```sql" in output:
                # Extract the SQL query from markdown code blocks
                import re
                sql_matches = re.search(r'```sql\s+([\s\S]*?)\s+```', output)
                if sql_matches:
                    sql_query = sql_matches.group(1).strip()
                    logger.info(f"Extracted SQL query: {sql_query}")
            
            return jsonify({
                "content": output,
                "sqlQuery": sql_query
            })
            
        except subprocess.TimeoutExpired:
            logger.error("Llama model process timed out")
            return jsonify({"error": "Timeout", "content": "AI model yanıt vermedi, işlem zaman aşımına uğradı."}), 504
            
        except FileNotFoundError:
            logger.error(f"Llama executable not found at: {LLAMA_PATH}")
            return jsonify({"error": "File not found", "content": "AI model bulunamadı."}), 404
            
    except Exception as e:
        logger.error(f"Completion error: {str(e)}")
        return jsonify({"error": str(e), "content": "AI istemcisinde bir hata oluştu."}), 500

@app.route('/api/execute-sql', methods=['POST'])
def execute_sql():
    try:
        data = request.json
        sql_query = data.get('query', '')
        logger.info(f"Received SQL query to execute: {sql_query}")
        
        if not sql_query:
            return jsonify({"error": "SQL sorgusu boş olamaz"}), 400
            
        try:
            # SQL sorgusu güvenlik kontrollerinden geçmeli
            lower_query = sql_query.lower()
            
            # Sadece SELECT sorgularına izin ver
            if not lower_query.strip().startswith('select'):
                return jsonify({"error": "Sadece SELECT sorguları kabul edilir"}), 400
                
            # Tehlikeli komutları kontrol et
            if any(cmd in lower_query for cmd in ['insert', 'update', 'delete', 'drop', 'truncate', 'alter', 'create']):
                return jsonify({"error": "Tehlikeli SQL komutlarına izin verilmiyor"}), 400
            
            # Supabase REST API üzerinden özel SQL çalıştır
            response = supabase.rpc(
                'execute_query', 
                {"query_text": sql_query}
            ).execute()
            
            logger.info(f"SQL query execution result: {len(response.data) if hasattr(response, 'data') else 'No data'}")
            
            if hasattr(response, 'error') and response.error:
                logger.error(f"SQL execution error: {response.error}")
                return jsonify({"error": str(response.error)}), 500
                
            return jsonify({"data": response.data})
                
        except Exception as e:
            logger.error(f"SQL execution error: {str(e)}")
            return jsonify({"error": f"SQL sorgusu çalıştırılırken hata: {str(e)}"}), 500
            
    except Exception as e:
        logger.error(f"SQL API general error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting PDKS Server on port 5050...")
    app.run(host='0.0.0.0', port=5050)

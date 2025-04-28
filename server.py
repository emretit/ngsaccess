
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
LLAMA_AVAILABLE = os.path.exists(LLAMA_PATH) and os.path.isfile(LLAMA_PATH) and os.access(LLAMA_PATH, os.X_OK) and os.path.exists(MODEL_PATH)

if LLAMA_AVAILABLE:
    logger.info(f"Llama model found at: {LLAMA_PATH}")
else:
    logger.warning(f"Llama model not found or not executable at: {LLAMA_PATH} or model file missing at: {MODEL_PATH}")
    logger.warning("Server will run in fallback mode (no local AI)")

@app.route('/status')
def status():
    try:
        # Supabase connection test
        logger.info("Testing Supabase connection via /status endpoint")
        test = supabase.table('card_readings').select("count", count='exact').execute()
        logger.info(f"Status check success: Found {test.count if hasattr(test, 'count') else 0} records")
        return jsonify({
            "status": "running",
            "database": "connected",
            "record_count": test.count if hasattr(test, 'count') else 0,
            "llama_available": LLAMA_AVAILABLE
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
        
        if not LLAMA_AVAILABLE:
            logger.warning("Llama model not available, returning friendly fallback response")
            # Check if it's a chat or report query
            is_report_query = "rapor:" in prompt.lower() or "report:" in prompt.lower()
            
            if is_report_query:
                # For report queries
                return jsonify({
                    "error": "Llama model not available",
                    "content": "Üzgünüm, rapor oluşturmak için gereken AI modeli bulunamadı. Lütfen sistem yöneticinizle iletişime geçin."
                }), 503
            else:
                # Generate a simple response based on the input for normal chat mode
                response = "Merhaba! Size nasıl yardımcı olabilirim?"
                
                if "merhaba" in prompt.lower() or "selam" in prompt.lower():
                    response = "Merhaba! Ben PDKS asistanıyım. Nasıl yardımcı olabilirim?"
                elif "nasılsın" in prompt.lower():
                    response = "Ben bir AI asistanı olarak harikayım, teşekkürler! Size nasıl yardımcı olabilirim?"
                elif "adın" in prompt.lower() or "ismin" in prompt.lower():
                    response = "Ben PDKS AI asistanıyım. Personel Devam Kontrol Sistemi verilerinizle ilgili sorularınızı yanıtlayabilirim."
                elif "teşekkür" in prompt.lower():
                    response = "Rica ederim! Başka bir konuda yardıma ihtiyacınız olursa buradayım."
                elif "ne yapabilirsin" in prompt.lower():
                    response = "Normal sohbet edebilirim veya 'Rapor:' ile başlayan sorularınızla PDKS verilerinizi analiz edebilirim. Örneğin: 'Rapor: Bugün işe gelenler' gibi."
                
                # For normal chat - return a friendly response
                return jsonify({
                    "content": response
                })
        
        # Llama model call
        cmd = [
            LLAMA_PATH,
            "-m", MODEL_PATH,
            "-c", "2048",  # Using a reasonable context size
            "-ngl", "0"    # Default to CPU for compatibility
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
            
            output, error = process.communicate(input=prompt, timeout=30)  # Add timeout
            
            if error:
                logger.error(f"Llama model error: {error}")
                return jsonify({"error": error, "content": "AI model çalıştırılırken bir hata oluştu."}), 500
                
            logger.info(f"Completion successful, generated {len(output)} chars")
            return jsonify({"content": output})
            
        except subprocess.TimeoutExpired:
            logger.error("Llama model process timed out")
            return jsonify({"error": "Timeout", "content": "AI model yanıt vermedi, işlem zaman aşımına uğradı."}), 504
            
        except FileNotFoundError:
            logger.error(f"Llama executable not found at: {LLAMA_PATH}")
            return jsonify({"error": "File not found", "content": "AI model bulunamadı."}), 404
            
    except Exception as e:
        logger.error(f"Completion error: {str(e)}")
        return jsonify({"error": str(e), "content": "AI istemcisinde bir hata oluştu."}), 500

@app.route('/api/pdks-report', methods=['POST'])
def get_pdks_report():
    try:
        data = request.json
        query = data.get('query', '').lower()
        logger.info(f"Received PDKS report query: {query}")
        
        try:
            # Base query structure
            base_query = supabase.table('card_readings').select(
                "*, employees(first_name, last_name, department:departments(name))"
            )
            
            # Finance department filtering
            if "finans" in query:
                logger.info("Applying finance department filter")
                base_query = base_query.eq('employees.department.name', 'Finans')
            
            # March filtering
            if "mart" in query:
                logger.info("Applying March month filter")
                base_query = base_query.gte('access_time', '2024-03-01T00:00:00')
                base_query = base_query.lt('access_time', '2024-04-01T00:00:00')
            
            logger.info("Executing Supabase query...")
            result = base_query.execute()
            logger.info(f"Query returned {len(result.data)} records")
            
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
                logger.info(f"Formatted {len(formatted_data)} records for response")
                return jsonify(formatted_data)
            else:
                logger.info("No records found for query")
                return jsonify([])
                
        except Exception as e:
            logger.error(f"Database error: {str(e)}")
            return jsonify({"error": f"Database error: {str(e)}"}), 500
            
    except Exception as e:
        logger.error(f"General error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting PDKS Server on port 5050...")
    app.run(host='0.0.0.0', port=5050)

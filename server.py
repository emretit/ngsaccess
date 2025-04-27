from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
import json
import logging
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime, timedelta

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

# LLama model configuration
LLAMA_MODEL_PATH = os.getenv('LLAMA_MODEL_PATH', 'model.gguf')
LLAMA_CONTEXT_SIZE = os.getenv('LLAMA_CONTEXT_SIZE', '4096')
LLAMA_GPU_LAYERS = os.getenv('LLAMA_GPU_LAYERS', '0')

logger.info(f"Supabase URL: {url}")  # Debug info
logger.info(f"Supabase Key: {key[:10]}..." if key else "Supabase Key: Not set")  # Only show first 10 chars for security
logger.info(f"LLama Model Path: {LLAMA_MODEL_PATH}")
logger.info(f"LLama Context Size: {LLAMA_CONTEXT_SIZE}")
logger.info(f"LLama GPU Layers: {LLAMA_GPU_LAYERS}")

try:
    supabase: Client = create_client(url, key)
    logger.info("Supabase connection successful!")
except Exception as e:
    logger.error(f"Supabase connection error: {str(e)}")

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
            "llama_model": LLAMA_MODEL_PATH
        })
    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
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
        logger.info(f"Received completion request with prompt: {prompt[:50]}...")
        
        # Llama model call
        cmd = [
            f"{os.path.dirname(os.path.realpath(__file__))}/llama.cpp/build/bin/llama-simple-chat",
            "-m", LLAMA_MODEL_PATH,
            "-c", LLAMA_CONTEXT_SIZE,
            "-ngl", LLAMA_GPU_LAYERS
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
            
            output, error = process.communicate(input=prompt, timeout=30)
            
            if error:
                logger.error(f"Llama model error: {error}")
                return jsonify({"error": error}), 500
                
            logger.info(f"Completion successful, generated {len(output)} chars")
            return jsonify({"content": output})
            
        except subprocess.TimeoutExpired:
            process.kill()
            logger.error("Llama model timeout")
            return jsonify({"error": "Model timed out"}), 504
            
    except Exception as e:
        logger.error(f"Completion error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/pdks-report', methods=['POST'])
def get_pdks_report():
    try:
        data = request.json
        
        # Sorguyu string veya obje olarak işle
        if isinstance(data.get('query'), str):
            try:
                # JSON string olarak parse etmeyi dene
                query_params = json.loads(data.get('query', '{}'))
            except json.JSONDecodeError:
                # Basit string olarak işle (eski format geriye uyumluluk için)
                query_params = {"text": data.get('query', '')}
        else:
            # Doğrudan obje olarak işle
            query_params = data.get('query', {})
        
        logger.info(f"Received PDKS report query params: {query_params}")
        
        try:
            # Base query structure
            base_query = supabase.table('card_readings').select(
                "*, employees(first_name, last_name, department:departments(name))"
            )
            
            # Departman filtresi
            if query_params.get('department'):
                logger.info(f"Applying department filter: {query_params['department']}")
                base_query = base_query.ilike('employees.department.name', f"%{query_params['department']}%")
            
            # Tarih aralığı filtresi
            if query_params.get('startDate'):
                start_date = f"{query_params['startDate']}T00:00:00"
                logger.info(f"Applying start date filter: {start_date}")
                base_query = base_query.gte('access_time', start_date)
            
            if query_params.get('endDate'):
                end_date = f"{query_params['endDate']}T23:59:59"
                logger.info(f"Applying end date filter: {end_date}")
                base_query = base_query.lte('access_time', end_date)
            
            # Ay ve yıl filtresi
            if not query_params.get('startDate') and query_params.get('month') and query_params.get('year'):
                month = query_params['month'].zfill(2)
                year = query_params['year']
                start_date = f"{year}-{month}-01T00:00:00"
                
                # Ay sonunu hesaplama
                if month == "12":
                    end_month = "01"
                    end_year = str(int(year) + 1)
                else:
                    end_month = str(int(month) + 1).zfill(2)
                    end_year = year
                
                end_date = f"{end_year}-{end_month}-01T00:00:00"
                
                logger.info(f"Applying month-year filter: {start_date} to {end_date}")
                base_query = base_query.gte('access_time', start_date)
                base_query = base_query.lt('access_time', end_date)
            
            # Durum filtresi
            if query_params.get('status'):
                status = query_params['status']
                if status == 'late':
                    logger.info("Applying late filter")
                    base_query = base_query.gt('late_minutes', 0)
                elif status == 'early-leave':
                    logger.info("Applying early leave filter")
                    base_query = base_query.gt('early_leave_minutes', 0)
            
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
                            "check_out": record.get('exit_time'),
                            "department": department_name,
                            "late_minutes": record.get('late_minutes', 0),
                            "early_leave_minutes": record.get('early_leave_minutes', 0),
                            "device": record.get('device_name', 'Bilinmeyen Cihaz'),
                            "location": record.get('location', 'Bilinmeyen Konum')
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

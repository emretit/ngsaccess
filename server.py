
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
            "record_count": test.count if hasattr(test, 'count') else 0
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
            "/Users/emreaydin/Desktop/ngsaccess/llama.cpp/build/bin/llama-simple-chat",
            "-m", "model.gguf",
            "-c", "context_size",
            "-ngl", "n_gpu_layers"
        ]
        
        logger.info(f"Executing command: {' '.join(cmd)}")
        
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        output, error = process.communicate(input=prompt)
        
        if error:
            logger.error(f"Llama model error: {error}")
            return jsonify({"error": error}), 500
            
        logger.info(f"Completion successful, generated {len(output)} chars")
        return jsonify({"content": output})
        
    except Exception as e:
        logger.error(f"Completion error: {str(e)}")
        return jsonify({"error": str(e)}), 500

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

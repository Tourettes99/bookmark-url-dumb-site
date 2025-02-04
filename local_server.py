from flask import Flask, request, jsonify
from flask_cors import CORS
import excel_handler
import os

app = Flask(__name__)
CORS(app)

@app.route('/api/urls', methods=['GET'])
def get_urls():
    token = request.args.get('token')
    if not token:
        return jsonify({'error': 'Token is required'}), 400
    
    try:
        urls = excel_handler.get_urls(token)
        return jsonify(urls)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/urls', methods=['POST'])
def save_url():
    data = request.json
    if not data or 'token' not in data or 'urlData' not in data:
        return jsonify({'error': 'Token and URL data are required'}), 400
    
    try:
        excel_handler.save_url(data['token'], data['urlData'])
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/urls/update', methods=['POST'])
def update_url():
    data = request.json
    if not data or 'token' not in data or 'urlData' not in data:
        return jsonify({'error': 'Token and URL data are required'}), 400
    
    try:
        success = excel_handler.update_url(data['token'], data['urlData'])
        if success:
            return jsonify({'success': True})
        return jsonify({'error': 'Failed to update URL'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)

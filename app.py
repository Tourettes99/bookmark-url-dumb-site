from flask import Flask, render_template, request, jsonify
import pandas as pd
from datetime import datetime
import os

app = Flask(__name__)

EXCEL_FILE = 'bookmarks.xlsx'

# Create Excel file if it doesn't exist
if not os.path.exists(EXCEL_FILE):
    df = pd.DataFrame(columns=['url', 'category', 'hashtags', 'timestamp', 'pinned'])
    df.to_excel(EXCEL_FILE, index=False)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/add_url', methods=['POST'])
def add_url():
    data = request.json
    df = pd.read_excel(EXCEL_FILE)
    
    new_url = pd.DataFrame([{
        'url': data['url'],
        'category': data['category'],
        'hashtags': data['hashtags'],
        'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'pinned': False
    }])
    
    # Use concat instead of append
    df = pd.concat([df, new_url], ignore_index=True)
    df.to_excel(EXCEL_FILE, index=False)
    
    return jsonify({'status': 'success'})

@app.route('/get_urls')
def get_urls():
    df = pd.read_excel(EXCEL_FILE)
    return jsonify(df.to_dict('records'))

@app.route('/toggle_pin', methods=['POST'])
def toggle_pin():
    data = request.json
    df = pd.read_excel(EXCEL_FILE)
    
    url_index = df[df['url'] == data['url']].index[0]
    df.at[url_index, 'pinned'] = not df.at[url_index, 'pinned']
    
    df.to_excel(EXCEL_FILE, index=False)
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    app.run(debug=True) 
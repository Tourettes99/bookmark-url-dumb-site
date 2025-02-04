import pandas as pd
import os
import sys
import json
from datetime import datetime

# Get the directory where the script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_FILE = os.path.join(SCRIPT_DIR, 'url_database.xlsx')

def ensure_excel_exists():
    if not os.path.exists(EXCEL_FILE):
        df = pd.DataFrame(columns=['token', 'url_data'])
        df.to_excel(EXCEL_FILE, index=False)

def save_url(token, url_data):
    ensure_excel_exists()
    try:
        df = pd.read_excel(EXCEL_FILE)
        
        # Check if token exists
        token_data = df[df['token'] == token]
        
        if token_data.empty:
            # Create new entry for token
            new_row = {'token': token, 'url_data': json.dumps([url_data])}
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        else:
            # Update existing token's data
            idx = token_data.index[0]
            current_data = json.loads(token_data.iloc[0]['url_data']) if isinstance(token_data.iloc[0]['url_data'], str) else []
            current_data.append(url_data)
            df.at[idx, 'url_data'] = json.dumps(current_data)
        
        df.to_excel(EXCEL_FILE, index=False)
        print(json.dumps({'success': True}))
        return True
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        return False

def get_urls(token):
    ensure_excel_exists()
    try:
        df = pd.read_excel(EXCEL_FILE)
        token_data = df[df['token'] == token]
        
        if token_data.empty:
            print(json.dumps([]))
            return []
        
        url_data = token_data.iloc[0]['url_data']
        result = json.loads(url_data) if isinstance(url_data, str) else []
        print(json.dumps(result))
        return result
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        return []

def update_url(token, updated_url_data):
    ensure_excel_exists()
    try:
        df = pd.read_excel(EXCEL_FILE)
        token_data = df[df['token'] == token]
        
        if token_data.empty:
            print(json.dumps({'error': 'Token not found'}))
            return False
        
        idx = token_data.index[0]
        current_data = json.loads(token_data.iloc[0]['url_data']) if isinstance(token_data.iloc[0]['url_data'], str) else []
        
        # Update the specific URL in the list
        updated = False
        for i, url in enumerate(current_data):
            if url['id'] == updated_url_data['id']:
                current_data[i] = updated_url_data
                updated = True
                break
        
        if updated:
            df.at[idx, 'url_data'] = json.dumps(current_data)
            df.to_excel(EXCEL_FILE, index=False)
            print(json.dumps({'success': True}))
            return True
        else:
            print(json.dumps({'error': 'URL not found'}))
            return False
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Invalid arguments'}))
        sys.exit(1)

    command = sys.argv[1]
    token = sys.argv[2]

    if command == 'save' and len(sys.argv) == 4:
        url_data = json.loads(sys.argv[3])
        save_url(token, url_data)
    elif command == 'get':
        get_urls(token)
    elif command == 'update' and len(sys.argv) == 4:
        updated_url_data = json.loads(sys.argv[3])
        update_url(token, updated_url_data)
    else:
        print(json.dumps({'error': 'Invalid command'}))
        sys.exit(1)

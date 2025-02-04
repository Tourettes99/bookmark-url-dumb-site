import pandas as pd
import os
import json

CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'links.csv')

def handler(event, context):
    token = event['queryStringParameters'].get('token')
    action = event['queryStringParameters'].get('action')
    
    try:
        df = pd.read_csv(CSV_PATH) if os.path.exists(CSV_PATH) else pd.DataFrame(columns=['token','url','category','hashtags','pinned','timestamp'])
        
        if action == 'generate_token':
            new_token = os.urandom(16).hex()
            if not df.empty and new_token in df['token'].values:
                return {'statusCode': 409, 'body': 'Token collision, try again'}
            return {'statusCode': 200, 'body': json.dumps({'token': new_token})}
        
        if not token:
            return {'statusCode': 400, 'body': 'Missing token parameter'}
        
        if action == 'get':
            data = df[df['token'] == token].to_dict('records')
            return {'statusCode': 200, 'body': json.dumps(data)}
            
        elif action == 'update':
            new_data = json.loads(event['body'])
            df = df[df['token'] != token]  # Remove old entries
            new_df = pd.DataFrame(new_data)
            new_df['token'] = token  # Ensure token consistency
            
            # Convert pinned to boolean
            if 'pinned' in new_df.columns:
                new_df['pinned'] = new_df['pinned'].astype(bool)
            
            df = pd.concat([df, new_df])
            df.to_csv(CSV_PATH, index=False)
            return {'statusCode': 200, 'body': 'Sync successful'}
            
    except Exception as e:
        return {'statusCode': 500, 'body': str(e)}

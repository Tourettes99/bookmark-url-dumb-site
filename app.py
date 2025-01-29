from flask import Flask, render_template, request, redirect, url_for, jsonify
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
import sqlite3
import os

app = Flask(__name__)

# Database initialization
def init_db():
    with sqlite3.connect('bookmarks.db') as conn:
        conn.execute('''
        CREATE TABLE IF NOT EXISTS bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            domain TEXT NOT NULL,
            category TEXT,
            hashtags TEXT,
            favicon TEXT,
            is_pinned INTEGER DEFAULT 0
        )
        ''')

def get_favicon(url):
    try:
        domain = urlparse(url).netloc
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        favicon = soup.find('link', rel='icon') or soup.find('link', rel='shortcut icon')
        if favicon and favicon.get('href'):
            favicon_url = favicon['href']
            if not favicon_url.startswith('http'):
                favicon_url = f"https://{domain}{favicon_url if favicon_url.startswith('/') else f'/{favicon_url}'}"
            return favicon_url
    except:
        pass
    return f"https://{domain}/favicon.ico"

@app.route('/')
def index():
    with sqlite3.connect('bookmarks.db') as conn:
        # Get regular links
        cursor = conn.execute('SELECT * FROM bookmarks WHERE is_pinned = 0 ORDER BY id DESC')
        links = []
        for row in cursor.fetchall():
            links.append({
                'id': row[0],
                'url': row[1],
                'domain': row[2],
                'category': row[3],
                'hashtags': row[4].split(',') if row[4] else [],
                'favicon': row[5]
            })

        # Get pinned links
        cursor = conn.execute('SELECT * FROM bookmarks WHERE is_pinned = 1 ORDER BY id DESC')
        pinned_links = []
        for row in cursor.fetchall():
            pinned_links.append({
                'id': row[0],
                'url': row[1],
                'domain': row[2],
                'favicon': row[5]
            })

    return render_template('index.html', links=links, pinned_links=pinned_links)

@app.route('/add', methods=['POST'])
def add_bookmark():
    url = request.form['url']
    category = request.form['category']
    hashtags = request.form['hashtags']
    
    domain = urlparse(url).netloc
    favicon = get_favicon(url)

    with sqlite3.connect('bookmarks.db') as conn:
        conn.execute('''
        INSERT INTO bookmarks (url, domain, category, hashtags, favicon)
        VALUES (?, ?, ?, ?, ?)
        ''', (url, domain, category, hashtags, favicon))

    return redirect(url_for('index'))

@app.route('/search')
def search():
    query = request.args.get('q', '').lower()
    with sqlite3.connect('bookmarks.db') as conn:
        cursor = conn.execute('''
        SELECT * FROM bookmarks 
        WHERE LOWER(url) LIKE ? OR LOWER(hashtags) LIKE ? OR LOWER(category) LIKE ?
        ''', (f'%{query}%', f'%{query}%', f'%{query}%'))
        
        links = []
        for row in cursor.fetchall():
            links.append({
                'id': row[0],
                'url': row[1],
                'domain': row[2],
                'category': row[3],
                'hashtags': row[4].split(',') if row[4] else [],
                'favicon': row[5]
            })

    return render_template('index.html', links=links, pinned_links=[])

@app.route('/pin/<int:id>', methods=['POST'])
def pin_bookmark(id):
    with sqlite3.connect('bookmarks.db') as conn:
        current = conn.execute('SELECT is_pinned FROM bookmarks WHERE id = ?', (id,)).fetchone()
        new_status = 0 if current[0] else 1
        conn.execute('UPDATE bookmarks SET is_pinned = ? WHERE id = ?', (new_status, id))
    return '', 204

@app.route('/delete/<int:id>', methods=['POST'])
def delete_bookmark(id):
    with sqlite3.connect('bookmarks.db') as conn:
        conn.execute('DELETE FROM bookmarks WHERE id = ?', (id,))
    return '', 204

if __name__ == '__main__':
    init_db()
    app.run(debug=True) 
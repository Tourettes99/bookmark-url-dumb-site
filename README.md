# Teach Mode Dumber - URL Bookmarking Site

A simple URL bookmarking site that allows you to save, categorize, and sync URLs across devices.

## Features

- Token-based synchronization between devices
- URL categorization and hashtag support
- Pin favorite URLs
- Search functionality across URLs, categories, and hashtags
- Responsive design for both mobile and desktop
- Local Excel storage with Netlify Functions integration

## Setup for Local Development

1. Install Node.js dependencies:
```bash
npm install
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Start the local database server:
```bash
python local_server.py
```
This will start a Flask server on port 5000 that handles all database operations.

4. Start the Netlify dev server:
```bash
netlify dev
```

The application will be available at http://localhost:8888

## Deployment

1. Push your code to GitHub:
```bash
git add .
git commit -m "Your commit message"
git push origin main
```

2. Connect your GitHub repository to Netlify for automatic deployments.

3. **Important**: The Excel database will stay on your local machine. When using the deployed site:
   - Keep the local server running on your PC
   - The site will connect to your local server for database operations
   - Your URLs will be stored in the Excel file on your PC

## Usage

1. Generate or sync a token
2. Add URLs with categories and hashtags
3. Optionally pin favorite URLs
4. Use the search functionality to find URLs quickly
5. Access your URLs from any device using the same token

## Tech Stack

- React
- Material UI
- Python
- Excel (via pandas)
- Netlify Functions

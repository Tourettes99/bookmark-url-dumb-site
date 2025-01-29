# 🔖 URL Bookmarker

A sleek, minimalist URL bookmarking application that lets you organize and categorize your favorite links with hashtags and custom categories. Built with vanilla JavaScript and styled with a modern dark theme featuring RAL 2005 orange accents.

## ✨ Features

- 📌 Pin important URLs to the sidebar
- 🏷️ Add custom categories and hashtags
- 🔍 Search through bookmarks by URL or hashtag
- 💾 Local storage persistence
- 📤 Export/Import bookmark data
- 🌙 Dark mode with orange accents
- 🖼️ Favicon display for each URL

## 🚀 Live Demo

Check out the live site: [URL Bookmarker](https://your-netlify-url-here.netlify.app)

## 🛠️ Setup

1. **Clone the repository**

bash
git clone https://github.com/Tourettes99/bookmark-url-dumb-site.git
cd bookmark-url-dumb-site

2. **Open in browser**
- Simply open `index.html` in your web browser
- Or use a local server:
  ```bash
  # Using Python
  python -m http.server 8000
  
  # Using Node.js
  npx serve
  ```

## 💻 Development

The project structure is simple and straightforward:

bookmark-url-dumb-site/
├── index.html
├── static/
│ ├── style.css
│ └── script.js
└── netlify.toml

## 🎨 Customization

The color scheme uses:
- Background: Black (`#000000`)
- Accent: RAL 2005 Orange (`#ff5c28`)
- Text: Light Gray (`#d3d3d3`)

To modify colors, edit the CSS variables in `static/style.css`:

css
:root {
--orange: #ff5c28;
--text-gray: #d3d3d3;
}

## 📱 Usage

1. **Adding URLs**
   - Enter the URL
   - Add a category
   - Include relevant hashtags (comma-separated)
   - Click "Add URL"

2. **Searching**
   - Use the search bar to find URLs by name or hashtag
   - Results update in real-time

3. **Pinning**
   - Click the pin icon on any bookmark to pin/unpin
   - Pinned items appear in the sidebar

4. **Import/Export**
   - Use the Export button to save your bookmarks
   - Use Import to restore from a backup

## 🔒 Privacy

All data is stored locally in your browser using localStorage. No data is sent to any server.

## 🤝 Contributing

Feel free to:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the MIT License.

## 👏 Acknowledgments

- Icons by Font Awesome
- Favicon service by Google
- Hosted on Netlify

---
Made with ❤️ by [Tourettes99](https://github.com/Tourettes99)
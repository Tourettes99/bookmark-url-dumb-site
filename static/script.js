// Local storage key for our bookmarks
const STORAGE_KEY = 'url_bookmarks';

// Initialize storage if empty
if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}

function addURL() {
    const url = document.getElementById('url-input').value;
    const category = document.getElementById('category-input').value;
    const hashtags = document.getElementById('hashtags-input').value;

    const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY));
    
    const newBookmark = {
        url: url,
        category: category,
        hashtags: hashtags,
        timestamp: new Date().toISOString(),
        pinned: false
    };

    bookmarks.push(newBookmark);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    
    loadURLs();
    clearInputs();
}

function clearInputs() {
    document.getElementById('url-input').value = '';
    document.getElementById('category-input').value = '';
    document.getElementById('hashtags-input').value = '';
}

function loadURLs() {
    const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY));
    displayURLs(bookmarks);
    updatePinnedLinks(bookmarks);
}

function displayURLs(urls) {
    const container = document.getElementById('urls-container');
    container.innerHTML = '';

    urls.forEach(url => {
        const card = createURLCard(url);
        container.appendChild(card);
    });
}

function createURLCard(urlData) {
    const card = document.createElement('div');
    card.className = 'url-card';
    
    // Get favicon URL
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(urlData.url).hostname}`;
    
    // Split hashtags into array
    const hashtags = urlData.hashtags.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    card.innerHTML = `
        <button class="pin-button" onclick="togglePin('${urlData.url}')">
            <i class="fas ${urlData.pinned ? 'fa-thumbtack' : 'fa-thumbtack'}"></i>
        </button>
        <div class="url-title">
            <a href="${urlData.url}" target="_blank">
                <img src="${faviconUrl}" class="favicon" alt="favicon">
                ${urlData.url}
            </a>
        </div>
        <div class="category">Category: ${urlData.category}</div>
        <div class="hashtags">
            ${hashtags.map(tag => `<span class="hashtag">#${tag}</span>`).join('')}
        </div>
    `;
    
    return card;
}

function updatePinnedLinks(urls) {
    const pinnedContainer = document.getElementById('pinned-links');
    pinnedContainer.innerHTML = '';

    urls.filter(url => url.pinned).forEach(url => {
        const link = document.createElement('div');
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url.url).hostname}`;
        
        link.innerHTML = `
            <a href="${url.url}" target="_blank">
                <img src="${faviconUrl}" class="favicon" alt="favicon">
                ${new URL(url.url).hostname}
            </a>
        `;
        link.className = 'pinned-link';
        pinnedContainer.appendChild(link);
    });
}

function togglePin(url) {
    const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const bookmark = bookmarks.find(b => b.url === url);
    if (bookmark) {
        bookmark.pinned = !bookmark.pinned;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
        loadURLs();
    }
}

function searchLinks() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY));
    
    const filtered = bookmarks.filter(bookmark => 
        bookmark.url.toLowerCase().includes(searchTerm) ||
        bookmark.hashtags.toLowerCase().includes(searchTerm)
    );
    
    displayURLs(filtered);
}

// Add export/import functionality
function exportToExcel() {
    const bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const blob = new Blob([JSON.stringify(bookmarks)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookmarks.json';
    a.click();
}

function importFromExcel(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const bookmarks = JSON.parse(e.target.result);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
            loadURLs();
        } catch (error) {
            alert('Invalid file format');
        }
    };
    
    reader.readAsText(file);
}

// Load URLs when page loads
document.addEventListener('DOMContentLoaded', loadURLs); 
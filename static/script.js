// Constants
const STORAGE_KEY = 'url_bookmarks';

// Initialize storage when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize storage if empty
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
    
    // Load existing URLs
    loadURLs();
    
    // Add event listeners
    document.getElementById('search-input')?.addEventListener('input', searchLinks);
});

// Using WebSocket for real-time communication
const socket = new WebSocket('ws://localhost:3000');

// Add connection status handling
socket.onopen = () => {
    console.log('Connected to WebSocket server');
};

socket.onerror = (error) => {
    console.error('WebSocket error:', error);
};

socket.onclose = () => {
    console.log('Disconnected from WebSocket server');
};

// Enable pusher logging - don't include this in production
Pusher.logToConsole = true;

const pusher = new Pusher(process.env.PUSHER_KEY, {
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    encrypted: true
});

// Subscribe to private channel (note the 'private-' prefix)
const channel = pusher.subscribe('private-bookmarks-channel');

channel.bind('pusher:subscription_succeeded', () => {
    console.log('Successfully subscribed to private channel');
});

channel.bind('pusher:subscription_error', (error) => {
    console.error('Subscription error:', error);
});

channel.bind('new-bookmark', function(data) {
    // Only show notification if it's from another user
    if (data.userId !== getCurrentUserId()) {
        showNotification(data, true);
    }
});

function addURL(event) {
    if (event) event.preventDefault();
    
    const urlInput = document.getElementById('url-input');
    const categoryInput = document.getElementById('category-input');
    const hashtagsInput = document.getElementById('hashtags-input');
    
    if (!urlInput.value) return;

    try {
        // Validate URL
        new URL(urlInput.value);

        const urlData = {
            url: urlInput.value,
            category: categoryInput.value,
            hashtags: hashtagsInput.value ? hashtagsInput.value.split(',').map(tag => tag.trim()) : [],
            timestamp: new Date().getTime(),
            pinned: false
        };

        // Get existing URLs and add new one
        const urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        urls.push(urlData);
        
        // Save back to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));

        // Clear inputs
        urlInput.value = '';
        categoryInput.value = '';
        hashtagsInput.value = '';

        // Reload URLs
        loadURLs();

        showNotification('URL added successfully!');
    } catch (e) {
        showNotification('Please enter a valid URL', 'error');
    }
}

function loadURLs() {
    const urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    
    // Load pinned links
    const pinnedLinksContainer = document.getElementById('pinned-links');
    if (pinnedLinksContainer) {
        pinnedLinksContainer.innerHTML = '';
        
        const pinnedUrls = urls.filter(url => url.pinned);
        
        if (pinnedUrls.length === 0) {
            pinnedLinksContainer.innerHTML = '<div class="no-pins">No pinned links yet</div>';
        } else {
            pinnedUrls.forEach(url => {
                const pinnedDiv = document.createElement('div');
                pinnedDiv.className = 'pinned-link';
                
                try {
                    const urlObj = new URL(url.url);
                    const faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}`;
                    
                    pinnedDiv.innerHTML = `
                        <a href="${url.url}" target="_blank">
                            <img src="${faviconUrl}" class="favicon" alt="favicon">
                            <span>${urlObj.hostname}</span>
                        </a>
                    `;
                    
                    pinnedLinksContainer.appendChild(pinnedDiv);
                } catch (e) {
                    console.error('Error processing URL:', url, e);
                }
            });
        }
    }

    // Load all URLs
    const urlsContainer = document.getElementById('urls-container');
    if (urlsContainer) {
        urlsContainer.innerHTML = '';
        
        if (urls.length === 0) {
            urlsContainer.innerHTML = '<div class="no-urls">No bookmarks yet</div>';
        } else {
            urls.forEach(url => {
                const urlElement = createURLElement(url);
                urlsContainer.appendChild(urlElement);
            });
        }
    }
}

function displayURLs(urls) {
    const container = document.getElementById('urls-container');
    container.innerHTML = '';

    urls.forEach(url => {
        const card = createURLElement(url);
        container.appendChild(card);
    });
}

function createURLElement(urlData) {
    const div = document.createElement('div');
    div.className = 'url-card';
    
    try {
        const url = new URL(urlData.url);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}`;
        
        const hashtags = Array.isArray(urlData.hashtags) 
            ? urlData.hashtags 
            : urlData.hashtags.split(',').map(tag => tag.trim());
        
        const hashtagsHtml = hashtags
            .filter(tag => tag)
            .map(tag => `<span class="hashtag">#${tag}</span>`)
            .join('');
        
        div.innerHTML = `
            <div class="url-title">
                <img src="${faviconUrl}" class="favicon" alt="favicon">
                <a href="${urlData.url}" target="_blank">${url.hostname}</a>
                <div class="url-actions">
                    <button class="pin-button" onclick="togglePin('${urlData.url}')">
                        ${urlData.pinned ? '📌' : '📍'}
                    </button>
                    <button class="delete-button" onclick="deleteURL('${urlData.url}')">
                        🗑️
                    </button>
                </div>
            </div>
            ${urlData.category ? `<div class="category">${urlData.category}</div>` : ''}
            <div class="hashtags">
                ${hashtagsHtml}
            </div>
        `;
    } catch (e) {
        console.error('Error creating URL element:', e);
    }
    
    return div;
}

function updatePinnedLinks(urls) {
    const pinnedContainer = document.getElementById('pinned-links');
    if (!pinnedContainer) {
        console.error('Pinned links container not found!');
        return;
    }
    
    pinnedContainer.innerHTML = '';
    
    const pinnedUrls = urls.filter(url => url.pinned);
    
    if (pinnedUrls.length === 0) {
        pinnedContainer.innerHTML = '<div class="no-pins">No pinned links yet</div>';
        return;
    }

    pinnedUrls.forEach(url => {
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
    const urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const urlIndex = urls.findIndex(item => item.url === url);
    
    if (urlIndex !== -1) {
        urls[urlIndex].pinned = !urls[urlIndex].pinned;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
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
document.addEventListener('DOMContentLoaded', function() {
    loadURLs();
});

function showNotification(urlData, isRemote) {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(urlData.url).hostname}`;
    const hostname = new URL(urlData.url).hostname;
    
    notification.innerHTML = `
        <img src="${faviconUrl}" class="favicon" alt="favicon">
        You bookmarked <strong>${hostname}</strong>
        ${urlData.category ? `in ${urlData.category}` : ''}
    `;
    
    container.appendChild(notification);
    
    // Remove notification after animation ends (5 seconds)
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Helper function to get/generate user ID
function getCurrentUserId() {
    return localStorage.getItem('userId') || 
           Math.random().toString(36).substring(2, 15);
}

function getCurrentUserName() {
    return localStorage.getItem('userName') || 'Anonymous';
}

// Add this new function to handle deletion
function deleteURL(url) {
    const urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const updatedUrls = urls.filter(item => item.url !== url);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUrls));
    loadURLs();
    showNotification('URL deleted successfully!');
} 
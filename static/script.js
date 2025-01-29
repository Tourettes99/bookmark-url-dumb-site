// Local storage key for our bookmarks
const STORAGE_KEY = 'url_bookmarks';

// Initialize storage if empty
if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}

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

// Add this near the top of the file
const pusher = new Pusher('YOUR_PUSHER_KEY', {
  cluster: 'YOUR_CLUSTER'
});

const channel = pusher.subscribe('bookmarks-channel');
channel.bind('new-bookmark', function(data) {
    // Only show notification if it's not from the current tab
    if (data.timestamp !== lastBookmarkTimestamp) {
        showNotification(data, true);
    }
});

// Modify the addURL function
function addURL(event) {
    event.preventDefault();
    const urlInput = document.getElementById('url');
    const categoryInput = document.getElementById('category');
    const hashtagsInput = document.getElementById('hashtags');
    
    const urlData = {
        url: urlInput.value,
        category: categoryInput.value,
        hashtags: hashtagsInput.value,
        timestamp: new Date().getTime()
    };

    // Store the timestamp to prevent duplicate notifications
    lastBookmarkTimestamp = urlData.timestamp;

    // Save to localStorage as before
    const urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    urls.push(urlData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));

    // Trigger Pusher event
    fetch('/.netlify/functions/trigger-notification', {
        method: 'POST',
        body: JSON.stringify(urlData),
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Show local notification
    showNotification(urlData, false);
    
    // Reset form
    urlInput.value = '';
    categoryInput.value = '';
    hashtagsInput.value = '';
    
    loadURLs();
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
            ${urlData.pinned ? '📌' : '📍'}
        </button>
        <a href="${urlData.url}" target="_blank">
            <img src="${faviconUrl}" class="favicon" alt="favicon">
            <span class="url-title">${urlData.url}</span>
        </a>
        <div class="category">${urlData.category}</div>
        <div class="hashtags">
            ${hashtags.map(tag => `<span class="hashtag">#${tag}</span>`).join('')}
        </div>
    `;
    
    return card;
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
    const urlIndex = urls.findIndex(u => u.url === url);
    
    if (urlIndex !== -1) {
        urls[urlIndex].pinned = !urls[urlIndex].pinned;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));
        displayURLs(urls);
        updatePinnedLinks(urls);
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
document.addEventListener('DOMContentLoaded', () => {
    const urls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    displayURLs(urls);
    updatePinnedLinks(urls);
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

// Update the onmessage handler to only show notifications for OTHER users
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'new_bookmark' && data.userId !== getCurrentUserId()) {  // Only show if it's not our own bookmark
        showNotification(data.data);
    }
};

// Helper function to get/generate user ID
function getCurrentUserId() {
    let userId = localStorage.getItem('user_id');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('user_id', userId);
    }
    return userId;
} 
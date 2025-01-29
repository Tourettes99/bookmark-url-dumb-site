const Excel = require('exceljs');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { initializeApp } = require('firebase/app');

// Initialize Firebase (add your config)
const firebaseConfig = {
    // Your Firebase config here
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const data = JSON.parse(event.body);
        const workbook = new Excel.Workbook();
        
        // Try to download existing file
        try {
            const fileRef = ref(storage, 'bookmarks.xlsx');
            const url = await getDownloadURL(fileRef);
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            await workbook.xlsx.load(buffer);
        } catch (error) {
            // File doesn't exist yet, create new worksheet
            workbook.addWorksheet('Bookmarks');
        }

        let worksheet = workbook.getWorksheet('Bookmarks');
        
        // Clear existing data
        worksheet.spliceRows(1, worksheet.rowCount);
        
        // Add headers
        worksheet.addRow(['URL', 'Category', 'Hashtags', 'Pinned', 'Date Added']);
        
        // Add data
        data.bookmarks.forEach(bookmark => {
            worksheet.addRow([
                bookmark.url,
                bookmark.category,
                bookmark.hashtags.join(', '),
                bookmark.pinned ? 'Yes' : 'No',
                bookmark.dateAdded
            ]);
        });

        // Save to buffer
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Upload to Firebase Storage
        const fileRef = ref(storage, 'bookmarks.xlsx');
        await uploadBytes(fileRef, buffer);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Sync successful' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Sync failed' })
        };
    }
}; 
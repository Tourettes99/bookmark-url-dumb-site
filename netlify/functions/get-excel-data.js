const Excel = require('exceljs');
const { getStorage, ref, getDownloadURL } = require('firebase/storage');
const { initializeApp } = require('firebase/app');

const firebaseConfig = {
    // Your Firebase config here
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

exports.handler = async function(event, context) {
    try {
        const fileRef = ref(storage, 'bookmarks.xlsx');
        const url = await getDownloadURL(fileRef);
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        
        const workbook = new Excel.Workbook();
        await workbook.xlsx.load(buffer);
        
        const worksheet = workbook.getWorksheet('Bookmarks');
        const bookmarks = [];
        
        // Skip header row
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                bookmarks.push({
                    url: row.getCell(1).value,
                    category: row.getCell(2).value,
                    hashtags: row.getCell(3).value.split(',').map(tag => tag.trim()),
                    pinned: row.getCell(4).value === 'Yes',
                    dateAdded: row.getCell(5).value
                });
            }
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ bookmarks })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to get data' })
        };
    }
}; 
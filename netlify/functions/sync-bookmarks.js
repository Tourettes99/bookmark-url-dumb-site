const Pusher = require('pusher');

const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true
});

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const data = JSON.parse(event.body);
        
        // Trigger update on the token-specific channel
        await pusher.trigger(`sync-channel-${data.token}`, 'sync-update', {
            source: data.source,
            bookmarks: data.bookmarks,
            timestamp: Date.now(),
            broadcast: true
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Sync successful',
                timestamp: Date.now()
            })
        };
    } catch (error) {
        console.error('Sync error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Sync failed' })
        };
    }
}; 
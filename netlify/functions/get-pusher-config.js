exports.handler = async function(event, context) {
    // Add debugging
    console.log('Function invoked with method:', event.httpMethod);
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // Debug environment variables
        console.log('Checking environment variables:', {
            hasKey: !!process.env.PUSHER_KEY,
            hasCluster: !!process.env.PUSHER_CLUSTER,
            hasAppId: !!process.env.PUSHER_APP_ID
        });

        const config = {
            key: process.env.PUSHER_KEY,
            cluster: process.env.PUSHER_CLUSTER,
            appId: process.env.PUSHER_APP_ID
        };

        // Validate config before sending
        if (!config.key || !config.cluster || !config.appId) {
            throw new Error('Missing required Pusher configuration');
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(config)
        };
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: 'Failed to get Pusher configuration',
                details: error.message
            })
        };
    }
}; 
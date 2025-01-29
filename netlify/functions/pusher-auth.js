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
    const socketId = data.socket_id;
    const channel = data.channel_name;
    const userId = data.user_id; // You'll need to pass this from your client

    // Generate auth signature
    const auth = pusher.authenticate(socketId, channel, {
      user_id: userId,
      user_info: {
        // Add any additional user info you want to pass
        name: data.user_name || 'Anonymous'
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(auth)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to authenticate' })
    };
  }
}; 
const { spawn } = require('child_process');
const path = require('path');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { token, urlData } = JSON.parse(event.body);
    
    // Run Python script
    const pythonProcess = spawn('python', [
      path.join(__dirname, '../../excel_handler.py'),
      'update',
      token,
      JSON.stringify(urlData)
    ]);

    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          resolve({
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update URL' })
          });
        } else {
          resolve({
            statusCode: 200,
            body: JSON.stringify({ message: 'URL updated successfully' })
          });
        }
      });
    });
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

const { spawn } = require('child_process');
const path = require('path');

exports.handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const token = event.queryStringParameters?.token;
    
    if (!token) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing token parameter' })
      };
    }

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [
        path.join(__dirname, '../../excel_handler.py'),
        'get',
        token
      ]);

      let dataString = '';
      let errorString = '';

      pythonProcess.stdout.on('data', (data) => {
        dataString += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorString += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0 || errorString) {
          console.error('Python script error:', errorString);
          resolve({
            statusCode: 500,
            headers: {
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
              error: 'Failed to get URLs',
              details: errorString
            })
          });
        } else {
          try {
            const result = JSON.parse(dataString);
            resolve({
              statusCode: 200,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(result)
            });
          } catch (e) {
            resolve({
              statusCode: 500,
              headers: {
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({ 
                error: 'Invalid response from Python script',
                details: dataString
              })
            });
          }
        }
      });
    });
  } catch (error) {
    console.error('Error in getUrls function:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};

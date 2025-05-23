// netlify/functions/trackman-proxy.js
exports.handler = async (event, context) => {
  // Only allow POST and GET methods
  if (!['POST', 'GET'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle preflight OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Get the target URL from query parameters
    const targetUrl = event.queryStringParameters?.url;
    if (!targetUrl) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing url parameter' })
      };
    }

    // Parse the request body if it exists
    let body = null;
    if (event.body) {
      try {
        body = event.body;
      } catch (e) {
        body = event.body;
      }
    }

    // Forward the request to TrackMan API
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: {
        'Content-Type': event.headers['content-type'] || 'application/json',
        'Accept': event.headers['accept'] || 'application/json',
        'Authorization': event.headers['authorization'] || ''
      },
      body: body
    });

    // Get response data
    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: 'Proxy failed', 
        details: error.message 
      })
    };
  }
};

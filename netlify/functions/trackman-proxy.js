// netlify/functions/trackman-proxy.js
exports.handler = async (event, context) => {
  console.log('TrackMan Proxy: Function invoked.');
  console.log('TrackMan Proxy: HTTP Method:', event.httpMethod);
  console.log('TrackMan Proxy: Query String Parameters:', JSON.stringify(event.queryStringParameters));
  console.log('TrackMan Proxy: Headers:', JSON.stringify(event.headers)); // Log incoming headers

  // Handle preflight OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    console.log('TrackMan Proxy: Handling OPTIONS preflight request.');
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Allow requests from any origin
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, baggage, sentry-trace', // Added baggage and sentry-trace just in case Tableau adds them
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST and GET methods (after OPTIONS is handled)
  if (!['POST', 'GET'].includes(event.httpMethod)) {
    console.error('TrackMan Proxy: Method not allowed:', event.httpMethod);
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

  try {
    const targetUrl = event.queryStringParameters?.url;
    console.log('TrackMan Proxy: Target URL:', targetUrl);

    if (!targetUrl) {
      console.error('TrackMan Proxy: Missing url parameter.');
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing url parameter' })
      };
    }

    let requestBody = null;
    if (event.body) {
        // Netlify functions can receive the body as a base64 encoded string if isBase64Encoded is true
        requestBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
        console.log('TrackMan Proxy: Request body received (first 100 chars):', requestBody.substring(0,100));
    } else {
        console.log('TrackMan Proxy: No request body received.');
    }
    
    // Prepare headers for the forwarded request
    // Forward essential headers from the original request
    const forwardedHeaders = {
        'Content-Type': event.headers['content-type'] || 'application/x-www-form-urlencoded', // Trackman token endpoint uses this
        'Accept': event.headers['accept'] || 'application/json',
        'Authorization': event.headers['authorization'] || '' // Forward Authorization header if present
    };
    // Remove undefined headers
    Object.keys(forwardedHeaders).forEach(key => forwardedHeaders[key] === undefined && delete forwardedHeaders[key]);
    console.log('TrackMan Proxy: Forwarding headers to TrackMan:', JSON.stringify(forwardedHeaders));


    console.log(`TrackMan Proxy: Fetching from target URL: ${targetUrl} with method: ${event.httpMethod}`);
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: forwardedHeaders,
      body: requestBody // Use the processed request body
    });

    console.log('TrackMan Proxy: Response status from TrackMan API:', response.status);
    console.log('TrackMan Proxy: Response status text from TrackMan API:', response.statusText);
    
    // Log response headers from TrackMan to see if they give any clues
    const responseHeaders = {};
    response.headers.forEach((value, name) => {
        responseHeaders[name] = value;
    });
    console.log('TrackMan Proxy: Response headers from TrackMan API:', JSON.stringify(responseHeaders));

    const responseText = await response.text();
    console.log('TrackMan Proxy: Response text from TrackMan API (first 300 chars):', responseText.substring(0, 300));

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      // If parsing fails, use the raw text (could be an error message or non-JSON response)
      responseData = responseText; 
    }

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': response.headers.get('content-type') || 'application/json' // Pass through Content-Type from target
      },
      body: JSON.stringify(responseData) // Ensure body is stringified for lambda response
    };

  } catch (error) {
    console.error('TrackMan Proxy: General proxy error:', error);
    console.error('TrackMan Proxy: Error message:', error.message);
    console.error('TrackMan Proxy: Error stack:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
         error: 'Proxy failed to process the request.',
         details: error.message
       })
    };
  }
};

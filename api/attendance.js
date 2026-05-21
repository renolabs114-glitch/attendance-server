const https = require('https');
const http = require('http');

// Helper: make HTTP/HTTPS POST request (follows redirects)
function forwardRequest(urlStr, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);

    function doRequest(currentUrl, redirectCount) {
      if (redirectCount > 10) return reject(new Error('Too many redirects'));

      const parsedUrl = new URL(currentUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = lib.request(options, (res) => {
        // Follow redirect
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          return doRequest(res.headers.location, redirectCount + 1);
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.setTimeout(12000, () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.write(body);
      req.end();
    }

    doRequest(urlStr, 0);
  });
}

// Main Vercel handler
module.exports = async (req, res) => {

  // Allow POST only
  if (req.method !== 'POST') {
    return res.status(200).send('Attendance Server Running OK');
  }

  const { sheet_url, payload } = req.body;

  if (!sheet_url || !payload) {
    return res.status(200).send('ERROR: Missing sheet_url or payload');
  }

  try {
    const googleResponse = await forwardRequest(sheet_url, payload);
    console.log('[OK] Google Response:', googleResponse);
    res.status(200).send(googleResponse);
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(200).send('ERROR: ' + err.message);
  }
};

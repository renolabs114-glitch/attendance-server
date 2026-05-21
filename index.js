const http = require('http');
const https = require('https');

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

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Attendance Server Running OK');
    return;
  }

  let rawBody = '';
  req.on('data', chunk => rawBody += chunk);
  req.on('end', async () => {
    try {
      const { sheet_url, payload } = JSON.parse(rawBody);

      if (!sheet_url || !payload) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ERROR: Missing sheet_url or payload');
        return;
      }

      const googleResponse = await forwardRequest(sheet_url, payload);
      console.log('[OK] Google Response:', googleResponse);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(googleResponse);
    } catch (err) {
      console.error('[ERROR]', err.message);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ERROR: ' + err.message);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Attendance server listening on 0.0.0.0:${PORT}`);
});

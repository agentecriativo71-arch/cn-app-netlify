import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import sirv from 'sirv';
import serverEntry from './dist/server/server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;

const assets = sirv(join(__dirname, 'dist/client'), {
  maxAge: 31536000,
  immutable: true,
});

const server = createServer((req, res) => {
  assets(req, res, async () => {
    try {
      // Build Web Request
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (typeof val === 'string') headers.set(key, val);
        else if (Array.isArray(val)) val.forEach(v => headers.append(key, v));
      }

      const init = {
        method: req.method,
        headers,
        duplex: 'half'
      };

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const Readable = await import('node:stream').then(m => m.Readable);
        init.body = Readable.toWeb(req);
      }

      const webReq = new Request(url, init);
      const webRes = await (serverEntry.fetch ? serverEntry.fetch(webReq) : serverEntry.default.fetch(webReq));

      res.statusCode = webRes.status;
      res.statusMessage = webRes.statusText;
      webRes.headers.forEach((val, key) => {
        res.appendHeader(key, val);
      });

      if (webRes.body) {
        const ReadableStream = await import('node:stream').then(m => m.Readable);
        const nodeStream = ReadableStream.fromWeb(webRes.body);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
});

server.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

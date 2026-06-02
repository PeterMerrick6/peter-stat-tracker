import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const port = Number(process.argv[2] ?? 5180);
const host = "127.0.0.1";
const root = resolve("dist");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(join(root, requestedPath));
  const resolvedPath = filePath.startsWith(root) && existsSync(filePath) ? filePath : join(root, "index.html");
  const contentType = contentTypes[extname(resolvedPath)] ?? "application/octet-stream";

  response.writeHead(200, { "Content-Type": contentType });
  createReadStream(resolvedPath).pipe(response);
}).listen(port, host, () => {
  console.log(`Peter-Daily is running at http://${host}:${port}/`);
});

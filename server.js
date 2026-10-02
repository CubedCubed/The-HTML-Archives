// The HTML Archives - backend server
// Stores categories and HTML files on disk so they are shared by every
// browser, device, and profile that can reach this server.
var http = require("http");
var fs = require("fs");
var path = require("path");

var PORT = process.env.PORT || 3000;
var HOST = process.env.HOST || "0.0.0.0";
var DATA_DIR = path.join(__dirname, "data");
var FILES_DIR = path.join(DATA_DIR, "files");
var ARCHIVE_JSON = path.join(DATA_DIR, "archive.json");

var archive = null;

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR);
  if (fs.existsSync(ARCHIVE_JSON)) {
    try {
      archive = JSON.parse(fs.readFileSync(ARCHIVE_JSON, "utf8"));
    } catch (e) {
      archive = null;
    }
  }
  if (!archive || !Array.isArray(archive.categories) || !Array.isArray(archive.files)) {
    archive = { categories: [], files: [], nextCatId: 1, nextFileId: 1 };
  }
  archive.files.forEach(function (f, index) {
    if (typeof f.sortOrder !== "number") f.sortOrder = index;
  });
}

function save() {
  fs.writeFileSync(ARCHIVE_JSON, JSON.stringify(archive, null, 2), "utf8");
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (c) { chunks.push(c); });
    req.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", reject);
  });
}

var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function sendJson(res, obj, status) {
  var body = JSON.stringify(obj);
  res.writeHead(status || 200, Object.assign({
    "Content-Type": "application/json; charset=utf-8"
  }, CORS));
  res.end(body);
}

function sendText(res, text, status, type) {
  res.writeHead(status || 200, Object.assign({
    "Content-Type": (type || "text/plain") + "; charset=utf-8"
  }, CORS));
  res.end(text);
}

var TYPES = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain"
};

function serveStatic(req, res, urlPath) {
  if (urlPath === "/") urlPath = "/index.html";
  var safe = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, "");
  var publicDir = path.join(__dirname, "public");
  var filePath = path.join(publicDir, safe);
  if (filePath.indexOf(publicDir) !== 0) return sendText(res, "Forbidden", 403);
  fs.readFile(filePath, function (err, data) {
    if (err) return sendText(res, "Not found", 404);
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, Object.assign({
      "Content-Type": (TYPES[ext] || "application/octet-stream") + "; charset=utf-8"
    }, CORS));
    res.end(data);
  });
}

function fileMeta(f) {
  return { id: f.id, name: f.name, categoryId: f.categoryId, sortOrder: f.sortOrder || 0, size: f.size, created: f.created };
}

var server = http.createServer(function (req, res) {
  var method = req.method;
  var urlPath = (req.url || "/").split("?")[0];

  if (method === "OPTIONS") return sendText(res, "", 204);

  // ---- API ----
  if (urlPath === "/api/state" && method === "GET") {
    return sendJson(res, {
      categories: archive.categories,
      files: archive.files.map(fileMeta)
    });
  }

  if (urlPath === "/api/categories" && method === "POST") {
    return readBody(req).then(function (body) {
      var data = JSON.parse(body || "{}");
      var name = (data.name || "").trim();
      if (!name) return sendJson(res, { error: "Name required" }, 400);
      var cat = { id: archive.nextCatId++, name: name, created: Date.now() };
      archive.categories.push(cat);
      save();
      sendJson(res, cat);
    }).catch(function () { sendJson(res, { error: "Bad request" }, 400); });
  }

  var catMatch = urlPath.match(/^\/api\/categories\/(\d+)$/);
  if (catMatch && method === "DELETE") {
    var catId = Number(catMatch[1]);
    archive.categories = archive.categories.filter(function (c) { return c.id !== catId; });
    save();
    return sendJson(res, { ok: true });
  }

  if (urlPath === "/api/files" && method === "POST") {
    return readBody(req).then(function (body) {
      var data = JSON.parse(body || "{}");
      var name = (data.name || "").trim();
      var content = data.content || "";
      if (!name) return sendJson(res, { error: "Name required" }, 400);
      var categoryId = data.categoryId ? Number(data.categoryId) : null;
      var id = archive.nextFileId++;
      fs.writeFileSync(path.join(FILES_DIR, id + ".html"), content, "utf8");
      var sameCategory = archive.files.filter(function (f) { return f.categoryId === categoryId; });
      var record = {
        id: id,
        name: name,
        categoryId: categoryId,
        sortOrder: sameCategory.length ? Math.max.apply(null, sameCategory.map(function (f) { return f.sortOrder || 0; })) + 1 : 0,
        size: Buffer.byteLength(content, "utf8"),
        created: Date.now()
      };
      archive.files.push(record);
      save();
      sendJson(res, fileMeta(record));
    }).catch(function (e) { sendJson(res, { error: "Bad request" }, 400); });
  }

  var fileMatch = urlPath.match(/^\/api\/files\/(\d+)$/);
  if (fileMatch) {
    var fid = Number(fileMatch[1]);
    var record = archive.files.filter(function (f) { return f.id === fid; })[0];
    if (!record) return sendJson(res, { error: "Not found" }, 404);

    if (method === "DELETE") {
      archive.files = archive.files.filter(function (f) { return f.id !== fid; });
      try { fs.unlinkSync(path.join(FILES_DIR, fid + ".html")); } catch (e) {}
      save();
      return sendJson(res, { ok: true });
    }

    if (method === "PUT") {
      return readBody(req).then(function (body) {
        var data = JSON.parse(body || "{}");
        if (typeof data.name === "string" && data.name.trim()) record.name = data.name.trim();
        if (data.categoryId === null) record.categoryId = null;
        else if (data.categoryId) record.categoryId = Number(data.categoryId);
        save();
        sendJson(res, fileMeta(record));
      }).catch(function () { sendJson(res, { error: "Bad request" }, 400); });
    }
  }

  var previewMatch = urlPath.match(/^\/api\/files\/(\d+)\/preview$/);
  if (previewMatch && method === "GET") {
    var pid = Number(previewMatch[1]);
    var prec = archive.files.filter(function (f) { return f.id === pid; })[0];
    if (!prec) return sendText(res, "Not found", 404, "text/plain");
    return fs.readFile(path.join(FILES_DIR, pid + ".html"), "utf8", function (err, data) {
      if (err) return sendText(res, "File missing", 404, "text/plain");
      sendText(res, data, 200, "text/html");
    });
  }

  var reorderMatch = urlPath.match(/^\/api\/files\/(\d+)\/reorder$/);
  if (reorderMatch && method === "PUT") {
    return readBody(req).then(function (body) {
      var data = JSON.parse(body || "{}");
      var ids = Array.isArray(data.fileIds) ? data.fileIds.map(Number) : [];
      var categoryId = data.categoryId ? Number(data.categoryId) : null;
      var inCategory = archive.files.filter(function (f) { return f.categoryId === categoryId; });
      if (ids.length !== inCategory.length || ids.some(function (id) { return !inCategory.some(function (f) { return f.id === id; }); })) {
        return sendJson(res, { error: "Invalid file order." }, 400);
      }
      ids.forEach(function (id, index) {
        var f = archive.files.filter(function (x) { return x.id === id; })[0];
        f.sortOrder = index;
      });
      save();
      sendJson(res, { ok: true });
    }).catch(function () { sendJson(res, { error: "Bad request" }, 400); });
  }

  var sourceMatch = urlPath.match(/^\/api\/files\/(\d+)\/source$/);
  if (sourceMatch && method === "GET") {
    var sid = Number(sourceMatch[1]);
    var srec = archive.files.filter(function (f) { return f.id === sid; })[0];
    if (!srec) return sendText(res, "Not found", 404, "text/plain");
    return fs.readFile(path.join(FILES_DIR, sid + ".html"), "utf8", function (err, data) {
      if (err) return sendText(res, "File missing", 404, "text/plain");
      sendText(res, data, 200, "text/plain");
    });
  }

  // ---- Static files (the website itself) ----
  return serveStatic(req, res, urlPath);
});

ensureStorage();
server.listen(PORT, HOST, function () {
  console.log("The HTML Archives is running.");
  console.log("Open locally:  http://localhost:" + PORT);
  console.log("Same Wi-Fi devices use your PC's IP, e.g. http://192.168.1.50:" + PORT);
  console.log("Press Ctrl+C to stop.");
});

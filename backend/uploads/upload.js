const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = __dirname;

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  // Modern phone cameras can produce larger originals, especially before the
  // app's JPEG normalization step. Keep a generous server-side ceiling while
  // still preventing unbounded uploads.
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
});

module.exports = upload;

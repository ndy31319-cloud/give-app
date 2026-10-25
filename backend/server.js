const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const db = require("./db");
const { splitEnvList } = require("./lib/env");

const app = express();
app.set("trust proxy", 1);
const configuredOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:8082",
  "http://127.0.0.1:8082",
  "https://give-web-kiosk.onrender.com",
  ...splitEnvList(process.env.CORS_ORIGINS),
];

const isAllowedOrigin = (origin) =>
  !origin ||
  configuredOrigins.includes(origin) ||
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
  /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      const error = new Error(`CORS origin is not allowed: ${origin}`);
      error.statusCode = 403;
      error.code = "CORS_ORIGIN_NOT_ALLOWED";
      return callback(error);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "give-backend",
    timestamp: new Date().toISOString(),
  });
});

// 회원 관련 라우터 연결
const authRoutes = require("./routes/auth");
const membersRoutes = require("./routes/members");
const postsRoutes = require("./routes/posts");
const chatRoutes = require("./routes/chat");
const deviceRoutes = require("./routes/device");
const notificationsRoutes = require("./routes/notifications");
const policiesRoutes = require("./routes/policies");
const wantedRoutes = require("./routes/wanted");
const productsRoutes = require("./routes/products");

app.use("/api/auth", authRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/certification", require("./routes/certification"));
app.use("/api/posts", postsRoutes);
app.use("/api/mypage", require("./routes/mypage"));
app.use("/api/chats", chatRoutes);
app.use("/api/device", deviceRoutes);
app.use("/api/member-qr", require("./routes/memberQr"));
app.use("/api/locker", require("./routes/locker").router);
app.use("/api/hardware", require("./routes/hardware"));
app.use("/api/notifications", notificationsRoutes);
app.use('/api/inquiries', require('./routes/inquiries'));
app.use('/api/reports', require('./routes/reports'));
app.use("/api/policies", policiesRoutes);
app.use("/api/wanted", wantedRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/trades", require("./routes/trades"));
app.use("/api/reviews", require("./routes/reviews"));

const trades = require("./services/trades");
const maintainTrades = () => trades.maintain().catch(error => console.error("Trade maintenance:", error.message));
maintainTrades();
setInterval(maintainTrades, 30000).unref();


// ==========================================
// 테스트 API
// ==========================================
app.get("/", (req, res) => {
  res.send("서버 연결 성공");
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: "요청한 API를 찾을 수 없습니다.",
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const isJsonParseError = error?.type === "entity.parse.failed";
  const isPayloadTooLarge = error?.type === "entity.too.large";
  const isUploadError = error instanceof multer.MulterError;
  const status = isPayloadTooLarge
    ? 413
    : isJsonParseError
      ? 400
    : isUploadError
      ? 400
    : error.statusCode || error.status || 500;
  const code = isJsonParseError
    ? "INVALID_JSON"
    : isPayloadTooLarge
      ? "PAYLOAD_TOO_LARGE"
    : isUploadError
      ? error.code || "UPLOAD_ERROR"
    : error.code || (status >= 500 ? "INTERNAL_SERVER_ERROR" : `HTTP_${status}`);
  const message = isJsonParseError
    ? "요청 JSON 형식이 올바르지 않습니다."
    : isPayloadTooLarge
      ? "요청 데이터가 너무 큽니다. 파일은 이미지 업로드 형식으로 나눠서 보내주세요."
    : isUploadError && error.code === "LIMIT_FILE_SIZE"
      ? "첨부 파일 용량이 너무 큽니다."
    : isUploadError
      ? "첨부 파일을 처리하지 못했습니다."
    : status >= 500
      ? "서버 처리 중 오류가 발생했습니다."
      : error.message || "요청 처리에 실패했습니다.";

  if (status >= 500) {
    console.error("Unhandled server error:", error);
  }

  return res.status(status).json({
    success: false,
    code,
    message,
  });
});

// ==========================================
// 서버 실행
// ==========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

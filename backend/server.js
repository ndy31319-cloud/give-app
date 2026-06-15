const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
app.use("/api/posts", postsRoutes);
app.use("/api/mypage", require("./routes/mypage"));
app.use("/api/chats", chatRoutes);
app.use("/api/device", deviceRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/policies", policiesRoutes);
app.use("/api/wanted", wantedRoutes);
app.use("/api/products", productsRoutes);


// ==========================================
// 테스트 API
// ==========================================
app.get("/", (req, res) => {
  res.send("서버 연결 성공");
});

// ==========================================
// 서버 실행
// ==========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");

const app = express();
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
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

app.use("/api/auth", authRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/mypage", require("./routes/mypage"));
app.use("/api/chats", chatRoutes);


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

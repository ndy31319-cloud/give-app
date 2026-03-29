require('dotenv').config();
const express = require('express');
const db = require('./db');

const app = express();
app.use(express.json());

// 회원 관련 라우터 연결
const authRoutes = require('./routes/auth');
const membersRoutes = require('./routes/members');
const postsRoutes = require('./routes/posts');

app.use('/api/auth', authRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/posts', postsRoutes)

// ==========================================
// 테스트 API
// ==========================================
app.get('/', (req, res) => {
  res.send('서버 연결 성공');
});


// ==========================================
// 서버 실행
// ==========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
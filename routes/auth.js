const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || '비밀키_입력하세요';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// ==========================================
// 1. 로그인 API (POST /api/auth/login)
// ==========================================
router.post('/login', async (req, res) => {
  const { phone, member_pw } = req.body;

  try {
    // 1-1. 입력값 검사
    if (!phone || !member_pw) {
      return res.status(400).json({
        success: false,
        message: '전화번호와 비밀번호를 모두 입력해주세요.'
      });
    }

    // 1-2. DB에서 전화번호로 유저 찾기
    const [users] = await db.query(
      'SELECT * FROM MEMBER WHERE phone = ?',
      [phone]
    );

    const user = users[0];

    // 가입되지 않은 번호
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '존재하지 않는 전화번호입니다.'
      });
    }

    // 1-3. 비밀번호 비교
    const isMatch = await bcrypt.compare(member_pw, user.member_pw);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '비밀번호가 일치하지 않습니다.'
      });
    }

    // 1-4. JWT 토큰 생성
    const token = jwt.sign(
      {
        member_id: user.member_id,
        phone: user.phone,
        role_id: user.role_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      success: true,
      message: '로그인 성공!',
      data: {
        token,
        member_id: user.member_id,
        phone: user.phone,
        role_id: user.role_id
      }
    });
  } catch (error) {
    console.error('로그인 에러:', error);
    return res.status(500).json({
      success: false,
      message: '서버 에러가 발생했습니다.'
    });
  }
});

// ==========================================
// 2. 로그아웃 API (POST /api/auth/logout)
// ==========================================
// JWT 방식에서는 보통 프론트에서 토큰 삭제 처리
router.post('/logout', async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: '로그아웃 성공!'
    });
  } catch (error) {
    console.error('로그아웃 에러:', error);
    return res.status(500).json({
      success: false,
      message: '서버 에러가 발생했습니다.'
    });
  }
});

module.exports = router;
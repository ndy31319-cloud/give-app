const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

// ==========================================
// 1. 회원가입 API (POST /api/members/signup)
// ==========================================
router.post('/signup', async (req, res) => {
  const { phone, member_pw, name, email, qr_code } = req.body;

  try {
    // 1-1. 입력값 검사
    if (!phone || !member_pw || !name || !email) {
      return res.status(400).json({
        success: false,
        message: '이름, 이메일, 전화번호, 비밀번호를 모두 입력해주세요.'
      });
    }

    // 1-2. 이미 가입된 전화번호인지 확인
    const [existingUsers] = await db.query(
      'SELECT member_id FROM MEMBER WHERE phone = ?',
      [phone]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 가입된 전화번호입니다.'
      });
    }

    // 기본 권한: USER = 1
    let role_id = 1;

    // 1-3. QR 코드가 있으면 인증 코드 유효성 확인
    if (qr_code) {
      const [certData] = await db.query(
        'SELECT code_id, is_used FROM CERTIFICATION_CODE WHERE code_id = ? AND is_used = FALSE',
        [qr_code]
      );

      if (certData.length === 0) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않거나 이미 사용된 인증번호입니다.'
        });
      }

      // 취약계층 권한: BENEFICIARY = 3
      role_id = 3;
    }

    // 1-4. 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(member_pw, 10);

    // 1-5. MEMBER 테이블에 회원 저장
    const [result] = await db.query(
      `INSERT INTO MEMBER (role_id, member_pw, name, email, phone)
       VALUES (?, ?, ?, ?, ?)`,
      [role_id, hashedPassword, name, email, phone]
    );

    // 1-6. qr_code가 있었다면 인증코드 사용 처리
    if (qr_code) {
      await db.query(
        `UPDATE CERTIFICATION_CODE
         SET is_used = TRUE,
             used_at = NOW(),
             member_id = ?
         WHERE code_id = ?`,
        [result.insertId, qr_code]
      );
    }

    return res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다!',
      data: {
        member_id: result.insertId,
        name,
        email,
        phone,
        role_id
      }
    });

  } catch (error) {
    console.error('회원가입 에러:', error);
    return res.status(500).json({
      success: false,
      message: '서버 에러가 발생했습니다.'
    });
  }
});

module.exports = router;
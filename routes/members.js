const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");
const router = express.Router();

// ==========================================
// 1. 회원가입 API (POST /api/members/signup)
// ==========================================
router.post("/signup", async (req, res) => {
  const {
    phone,
    member_pw,
    name,
    email,
    qr_code,
    dong_name,
    latitude,
    longitude,
  } = req.body;

  try {
    // 1-1. 입력값 검사 (위치 정보 필수 확인)
    if (
      !phone ||
      !member_pw ||
      !name ||
      !email ||
      !dong_name ||
      !latitude ||
      !longitude
    ) {
      return res.status(400).json({
        success: false,
        message:
          "필수 정보(이름, 이메일, 전화번호, 비밀번호, 동네 이름, 위도, 경도)를 모두 입력해주세요.",
      });
    }

    // 1-2. 이미 가입된 전화번호인지 확인
    const [existingUsers] = await db.query(
      "SELECT member_id FROM MEMBER WHERE phone = ?",
      [phone],
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "이미 가입된 전화번호입니다.",
      });
    }

    // 기본 권한: USER = 1
    let role_id = 1;

    // 1-3. QR 코드가 있으면 인증 코드 유효성 확인
    if (qr_code) {
      const [certData] = await db.query(
        "SELECT code_id, is_used FROM CERTIFICATION_CODE WHERE code_id = ? AND is_used = FALSE",
        [qr_code],
      );

      if (certData.length === 0) {
        return res.status(400).json({
          success: false,
          message: "유효하지 않거나 이미 사용된 인증번호입니다.",
        });
      }

      // 취약계층 권한: BENEFICIARY = 3
      role_id = 3;
    }

    // 1-4. 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(member_pw, 10);

    // 1-5. MEMBER 테이블에 회원 및 위치 정보 저장
    const [result] = await db.query(
      `INSERT INTO MEMBER (role_id, member_pw, name, email, phone, dong_name, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        role_id,
        hashedPassword,
        name,
        email,
        phone,
        dong_name,
        latitude,
        longitude,
      ],
    );

    // 1-6. qr_code가 있었다면 인증코드 사용 처리
    if (qr_code) {
      await db.query(
        `UPDATE CERTIFICATION_CODE
         SET is_used = TRUE,
             used_at = NOW(),
             member_id = ?
         WHERE code_id = ?`,
        [result.insertId, qr_code],
      );
    }

    // 1-7. 응답 데이터에도 위치 정보 포함
    return res.status(201).json({
      success: true,
      message: "회원가입이 완료되었습니다!",
      data: {
        member_id: result.insertId,
        name,
        email,
        phone,
        role_id,
        dong_name,
        latitude,
        longitude,
      },
    });
  } catch (error) {
    console.error("회원가입 에러:", error);
    return res.status(500).json({
      success: false,
      message: "서버 에러가 발생했습니다.",
    });
  }
});

// ==========================================
// 2. 내 정보 조회 API (GET /api/members/me)
// ==========================================
router.get("/me", authenticateToken, async (req, res) => {
  // 토큰에서 내 유저 번호 꺼내기
  const member_id = req.user.member_id || req.user.id;

  try {
    // 비밀번호를 제외한 내 프로필 정보(이름, 이메일, 전화번호 등) 가져오기
    const [rows] = await db.query(
      `SELECT member_id, name, email, phone, role_id, created_at 
             FROM MEMBER 
             WHERE member_id = ?`,
      [member_id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "사용자 정보를 찾을 수 없습니다." });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("내 정보 조회 에러:", error);
    res.status(500).json({ message: "내 정보를 불러오는데 실패했습니다." });
  }
});
// ==========================================
// 3. 내 정보 수정 API (PATCH /api/members/me)
// ==========================================
router.patch("/me", authenticateToken, async (req, res) => {
  // 토큰에서 내 유저 번호 꺼내기
  const member_id = req.user.member_id || req.user.id;

  // 프론트에서 보낸 수정할 데이터 받기
  const { name, email, phone } = req.body;

  // 1. 들어온 값만 골라서 쿼리 조립할 배열 준비
  let updateFields = [];
  let queryParams = [];

  // 값이 있는 것만 배열에 추가
  if (name) {
    updateFields.push("name = ?");
    queryParams.push(name);
  }
  if (email) {
    updateFields.push("email = ?");
    queryParams.push(email);
  }
  if (phone) {
    updateFields.push("phone = ?");
    queryParams.push(phone);
  }

  // 2. 아무것도 안 보냈으면 차단
  if (updateFields.length === 0) {
    return res
      .status(400)
      .json({ message: "수정할 정보를 하나 이상 입력해주세요." });
  }

  // 3. WHERE 조건에 쓸 유저 번호를 마지막에 추가
  queryParams.push(member_id);

  try {
    // 4. 동적으로 쿼리문 합체해서 실행
    const sql = `UPDATE MEMBER SET ${updateFields.join(", ")} WHERE member_id = ?`;
    const [result] = await db.query(sql, queryParams);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "사용자 정보를 찾을 수 없거나 수정되지 않았습니다." });
    }

    res.status(200).json({ message: "내 정보가 성공적으로 수정되었습니다." });
  } catch (error) {
    console.error("내 정보 수정 에러:", error);
    res.status(500).json({ message: "내 정보를 수정하는데 실패했습니다." });
  }
});

// ==========================================
// 4. 내 정보(동네 포함) 수정 API (PATCH /api/members/me/location)
// ==========================================
router.patch("/me/location", authenticateToken, async (req, res) => {
  const member_id = req.user.member_id || req.user.id;
  const { dong_name, latitude, longitude } = req.body;

  if (!dong_name || !latitude || !longitude) {
    return res
      .status(400)
      .json({ message: "동네 정보(이름, 위도, 경도)를 모두 입력해주세요." });
  }

  try {
    // MEMBER 테이블의 동네 및 좌표 정보 업데이트
    const [result] = await db.query(
      `UPDATE MEMBER 
       SET dong_name = ?, latitude = ?, longitude = ? 
       WHERE member_id = ?`,
      [dong_name, latitude, longitude, member_id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "사용자 정보를 찾을 수 없습니다." });
    }

    res.status(200).json({
      message: "동네 설정이 완료되었습니다.",
      data: {
        dong_name,
        latitude,
        longitude,
      },
    });
  } catch (error) {
    console.error("동네 설정 에러:", error);
    res.status(500).json({ message: "동네 설정에 실패했습니다." });
  }
});
module.exports = router;

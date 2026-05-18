const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "give-local-development-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

const formatPhoneNumber = (phone) => {
  const cleaned = String(phone || "").replace(/\D/g, "");
  return cleaned.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3");
};

const normalizeLoginIdentifier = (value) => String(value || "").trim();

const getIdentifierMismatch = (identifier) => {
  if (identifier.includes("@")) {
    return {
      field: "email",
      message: "등록되지 않은 이메일입니다.",
    };
  }

  const digitCount = identifier.replace(/\D/g, "").length;

  if (digitCount >= 9) {
    return {
      field: "phone",
      message: "등록되지 않은 전화번호입니다.",
    };
  }

  return {
    field: "identifier",
    message: "등록되지 않은 이메일 또는 전화번호입니다.",
  };
};

const formatUser = (user) => ({
  id: user.member_id,
  memberId: user.member_id,
  member_id: user.member_id,
  name: user.name,
  nickname: user.nickname,
  email: user.email,
  phone: user.phone,
  role: user.role_name,
  roleName: user.role_name,
  role_name: user.role_name,
  roleId: user.role_id,
  role_id: user.role_id,
  dongName: user.dong_name,
  dong_name: user.dong_name,
  createdAt: user.created_at,
  created_at: user.created_at,
});

router.post("/login", async (req, res) => {
  const identifier = normalizeLoginIdentifier(req.body.identifier || req.body.email || req.body.phone);
  const memberPw = req.body.member_pw || req.body.password;
  const formattedPhone = formatPhoneNumber(identifier);

  try {
    if (!identifier || !memberPw) {
      return res.status(400).json({
        success: false,
        message: "이메일 또는 전화번호와 비밀번호를 입력해주세요.",
      });
    }

    const [users] = await db.query(
      `SELECT m.*, r.role_name
       FROM MEMBER m
       LEFT JOIN ROLE r ON m.role_id = r.role_id
       WHERE m.email = ? OR m.phone = ? OR m.phone = ?
       LIMIT 1`,
      [identifier, identifier, formattedPhone],
    );
    const user = users[0];

    if (!user) {
      const mismatch = getIdentifierMismatch(identifier);

      return res.status(401).json({
        success: false,
        field: mismatch.field,
        message: mismatch.message,
      });
    }

    const storedPassword = String(user.member_pw || "");
    const isHashedPassword = /^\$2[aby]\$/.test(storedPassword);
    const isMatch = isHashedPassword ? await bcrypt.compare(memberPw, storedPassword) : false;

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        field: "password",
        message: "비밀번호가 올바르지 않습니다.",
      });
    }

    const token = jwt.sign(
      {
        member_id: user.member_id,
        email: user.email,
        role_id: user.role_id,
        role: user.role_name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    return res.status(200).json({
      success: true,
      message: "로그인에 성공했습니다.",
      data: {
        access_token: token,
        token,
        user: formatUser(user),
        member_id: user.member_id,
        nickname: user.nickname,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role_name,
        role_id: user.role_id,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
});

router.post("/logout", async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "로그아웃에 성공했습니다.",
  });
});

module.exports = router;

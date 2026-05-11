const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "please-change-this-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

const formatUser = (user) => ({
  id: user.member_id,
  memberId: user.member_id,
  member_id: user.member_id,
  name: user.name,
  nickname: user.nickname,
  email: user.email,
  phone: user.phone,
  roleId: user.role_id,
  role_id: user.role_id,
  dongName: user.dong_name,
  dong_name: user.dong_name,
  createdAt: user.created_at,
  created_at: user.created_at,
});

router.post("/login", async (req, res) => {
  const identifier = req.body.email || req.body.phone;
  const password = req.body.password || req.body.member_pw;

  try {
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "이메일 또는 전화번호와 비밀번호를 입력해주세요.",
      });
    }

    const [users] = await db.query(
      "SELECT * FROM MEMBER WHERE email = ? OR phone = ? LIMIT 1",
      [identifier, identifier],
    );
    const user = users[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "존재하지 않는 계정입니다.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.member_pw);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "비밀번호가 일치하지 않습니다.",
      });
    }

    const token = jwt.sign(
      {
        member_id: user.member_id,
        email: user.email,
        role_id: user.role_id,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    return res.status(200).json({
      success: true,
      message: "로그인에 성공했습니다.",
      data: {
        token,
        user: formatUser(user),
        member_id: user.member_id,
        email: user.email,
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

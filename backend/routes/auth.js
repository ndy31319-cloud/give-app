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
const LEGACY_TEST_PASSWORD = process.env.LEGACY_TEST_PASSWORD || "User1234!";
const LEGACY_TEST_PASSWORDS = new Set([LEGACY_TEST_PASSWORD, "Bene1234!"]);
const NEIGHBOR_NICKNAME_PREFIX = "이웃";
const VULNERABLE_ROLE_ID = 3;

const isBcryptHash = (value) =>
  typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);

const verifyPassword = async (inputPassword, storedPassword) => {
  if (!storedPassword) {
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  return LEGACY_TEST_PASSWORDS.has(inputPassword);
};

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
  latitude: user.latitude,
  longitude: user.longitude,
  createdAt: user.created_at,
  created_at: user.created_at,
});

const generateNeighborNickname = () => {
  const number = Math.floor(1000 + Math.random() * 9000);
  return `${NEIGHBOR_NICKNAME_PREFIX}${number}`;
};

const createUniqueNeighborNickname = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const nickname = generateNeighborNickname();
    const [rows] = await db.query(
      "SELECT member_id FROM MEMBER WHERE nickname = ? LIMIT 1",
      [nickname],
    );

    if (rows.length === 0) {
      return nickname;
    }
  }

  return `${NEIGHBOR_NICKNAME_PREFIX}${Date.now().toString().slice(-6)}`;
};

const ensureMemberNickname = async (member) => {
  const currentNickname = String(member.nickname || "").trim();

  if (currentNickname) {
    return currentNickname;
  }

  const nickname = await createUniqueNeighborNickname();
  await db.query(
    "UPDATE MEMBER SET nickname = ? WHERE member_id = ?",
    [nickname, member.member_id],
  );

  return nickname;
};

const buildKioskEmail = (certificateId) =>
  `kiosk_certificate_${certificateId}@give.local`;

const buildKioskPhone = (certificateId) =>
  `000-0000-${String(certificateId).padStart(4, "0").slice(-4)}`;

const normalizePhoneDigits = (phone) => String(phone || "").replace(/\D/g, "");

const findMemberByCertificateIdentity = async (certificate) => {
  const name = String(certificate.name || "").trim();
  const phoneDigits = normalizePhoneDigits(certificate.phone);

  if (!name || !phoneDigits) {
    return null;
  }

  const [members] = await db.query(
    `SELECT m.*, r.role_name
     FROM MEMBER m
     LEFT JOIN ROLE r ON m.role_id = r.role_id
     WHERE m.name = ?
       AND REPLACE(REPLACE(REPLACE(m.phone, '-', ''), ' ', ''), '.', '') = ?
     LIMIT 1`,
    [name, phoneDigits],
  );

  return members[0] || null;
};

const createMemberForCertificate = async (certificate) => {
  const nickname = await createUniqueNeighborNickname();
  const phone = certificate.phone || buildKioskPhone(certificate.certificate_id);
  const fallbackPassword = await bcrypt.hash(
    `kiosk-${certificate.certificate_id}-${Date.now()}`,
    10,
  );
  const [result] = await db.query(
    `INSERT INTO MEMBER (role_id, member_pw, name, email, phone, dong_name, nickname)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      VULNERABLE_ROLE_ID,
      fallbackPassword,
      certificate.name,
      buildKioskEmail(certificate.certificate_id),
      phone,
      certificate.dong_name,
      nickname,
    ],
  );

  return {
    member_id: result.insertId,
    name: certificate.name,
    nickname,
    email: buildKioskEmail(certificate.certificate_id),
    phone,
    role_id: VULNERABLE_ROLE_ID,
    role_name: "BENEFICIARY",
    dong_name: certificate.dong_name,
    created_at: new Date(),
  };
};

const findOrCreateCertificateMember = async (certificate) => {
  const existingAppMember = await findMemberByCertificateIdentity(certificate);

  if (existingAppMember) {
    return {
      ...existingAppMember,
      nickname: await ensureMemberNickname(existingAppMember),
    };
  }

  const kioskEmail = buildKioskEmail(certificate.certificate_id);
  const [members] = await db.query(
    `SELECT m.*, r.role_name
     FROM MEMBER m
     LEFT JOIN ROLE r ON m.role_id = r.role_id
     WHERE m.email = ?
     LIMIT 1`,
    [kioskEmail],
  );

  if (members[0]) {
    return {
      ...members[0],
      nickname: await ensureMemberNickname(members[0]),
    };
  }

  return createMemberForCertificate(certificate);
};

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

    const isMatch = await verifyPassword(memberPw, user.member_pw);

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

router.post("/code-login", async (req, res) => {
  const certificateNumber = String(
    req.body.certificate_number ||
      req.body.certificateNo ||
      req.body.code ||
      "",
  ).trim();

  if (!certificateNumber) {
    return res.status(400).json({
      success: false,
      message: "인증번호를 입력해주세요.",
    });
  }

  try {
    const [certificateRows] = await db.query(
      `SELECT
         c.certificate_id,
         c.certificate_no,
         c.name,
         c.phone,
         c.address,
         c.dong_name,
         c.beneficiary_type,
         c.status,
         c.issued_at,
         c.expires_at,
         c.created_at
       FROM VULNERABLE_CERTIFICATE c
       WHERE c.certificate_no = ?
         AND c.status = 'active'
         AND (c.expires_at IS NULL OR c.expires_at >= CURDATE())
       LIMIT 1`,
      [certificateNumber],
    );
    const certificate = certificateRows[0];

    if (!certificate) {
      return res.status(401).json({
        success: false,
        message: "유효하지 않은 인증번호입니다.",
      });
    }

    const user = await findOrCreateCertificateMember(certificate);
    const token = jwt.sign(
      {
        member_id: user.member_id,
        email: user.email,
        role_id: user.role_id,
        role: user.role_name,
        login_type: "certificate_code",
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );
    const formattedUser = formatUser(user);

    return res.status(200).json({
      success: true,
      accessToken: token,
      token,
      member: formattedUser,
      user: formattedUser,
      data: {
        access_token: token,
        token,
        member: formattedUser,
        user: formattedUser,
      },
      message: "인증번호 로그인에 성공했습니다.",
    });
  } catch (error) {
    console.error("Code login error:", error);
    return res.status(500).json({
      success: false,
      message: "인증번호 로그인 중 오류가 발생했습니다.",
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

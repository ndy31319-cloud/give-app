const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "give-local-development-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

const requireDevelopmentOnly = (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      message: "This delete API is only available in development.",
    });
  }

  next();
};

const requireDevDeleteKey = (req, res, next) => {
  const expectedKey = process.env.ADMIN_DELETE_KEY;

  if (!expectedKey) {
    return next();
  }

  const providedKey = req.headers["x-dev-delete-key"];

  if (providedKey !== expectedKey) {
    return res.status(403).json({
      success: false,
      message: "Invalid development delete key.",
    });
  }

  next();
};

const formatPhoneNumber = (phone) => {
  const cleaned = String(phone || "").replace(/\D/g, "");
  return cleaned.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3");
};

const isNicknameTaken = async (nickname, excludeMemberId = null) => {
  const normalizedNickname = String(nickname || "").trim();

  if (!normalizedNickname) {
    return false;
  }

  if (excludeMemberId) {
    const [rows] = await db.query(
      "SELECT member_id FROM MEMBER WHERE nickname = ? AND member_id != ? LIMIT 1",
      [normalizedNickname, excludeMemberId]
    );
    return rows.length > 0;
  }

  const [rows] = await db.query(
    "SELECT member_id FROM MEMBER WHERE nickname = ? LIMIT 1",
    [normalizedNickname]
  );
  return rows.length > 0;
};

const buildInClause = (ids) => ids.map(() => "?").join(", ");

const deleteMemberRelatedData = async (connection, memberId) => {
  const [donateRows] = await connection.query(
    "SELECT donate_id FROM ITEM_DONATE WHERE member_id = ?",
    [memberId]
  );
  const [requestRows] = await connection.query(
    "SELECT request_id FROM ITEM_REQUEST WHERE member_id = ?",
    [memberId]
  );

  const donateIds = donateRows.map((row) => row.donate_id);
  const requestIds = requestRows.map((row) => row.request_id);

  if (donateIds.length > 0) {
    const donateInClause = buildInClause(donateIds);

    await connection.query(
      `DELETE FROM ITEM_DONATE_IMAGE WHERE donate_id IN (${donateInClause})`,
      donateIds
    );
    await connection.query(
      `DELETE FROM ITEM WHERE donate_id IN (${donateInClause})`,
      donateIds
    );
    await connection.query(
      `DELETE FROM ITEM_DONATE WHERE donate_id IN (${donateInClause})`,
      donateIds
    );
  }

  if (requestIds.length > 0) {
    const requestInClause = buildInClause(requestIds);

    await connection.query(
      `DELETE FROM ITEM_REQUEST_IMAGE WHERE request_id IN (${requestInClause})`,
      requestIds
    );
    await connection.query(
      `DELETE FROM ITEM WHERE request_id IN (${requestInClause})`,
      requestIds
    );
    await connection.query(
      `DELETE FROM ITEM_REQUEST WHERE request_id IN (${requestInClause})`,
      requestIds
    );
  }

  await connection.query(
    "UPDATE CERTIFICATION_CODE SET member_id = NULL WHERE member_id = ?",
    [memberId]
  );
};

const deleteMemberWithRelations = async (memberId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    await deleteMemberRelatedData(connection, memberId);

    const [result] = await connection.query(
      "DELETE FROM MEMBER WHERE member_id = ?",
      [memberId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return false;
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

router.get("/nickname-check", async (req, res) => {
  const nickname = String(req.query.nickname || "").trim();

  if (!nickname) {
    return res.status(400).json({
      success: false,
      message: "Nickname is required.",
      available: false,
    });
  }

  try {
    const taken = await isNicknameTaken(nickname);

    return res.status(200).json({
      success: true,
      available: !taken,
      message: taken ? "This nickname is already taken." : "Nickname is available.",
    });
  } catch (error) {
    console.error("Nickname check error:", error);
    return res.status(500).json({
      success: false,
      available: false,
      message: "Failed to check nickname availability.",
    });
  }
});

router.post("/signup", async (req, res) => {
  const { phone, member_pw, name, email, qr_code, dong_name, nickname, isVulnerable } = req.body;

  try {
    if (!phone || !member_pw || !name || !email || !dong_name || !nickname) {
      return res.status(400).json({
        success: false,
        message: "Required signup fields are missing.",
      });
    }

    const formattedPhone = formatPhoneNumber(phone);
    const pwRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

    if (!pwRegex.test(member_pw)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters and include a number and special character.",
      });
    }

    const [existingUsers] = await db.query(
      "SELECT member_id FROM MEMBER WHERE phone = ? OR email = ?",
      [formattedPhone, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Phone number or email is already registered.",
      });
    }

    const nicknameTaken = await isNicknameTaken(nickname);

    if (nicknameTaken) {
      return res.status(400).json({
        success: false,
        message: "Nickname is already in use.",
        field: "nickname",
      });
    }

    let role_id = 1;
    const allowDevelopmentVulnerableSignup =
      process.env.NODE_ENV !== "production" && isVulnerable === true;

    if (qr_code) {
      const [certData] = await db.query(
        "SELECT code_id FROM CERTIFICATION_CODE WHERE code_id = ? AND is_used = FALSE",
        [qr_code]
      );

      if (certData.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid or already used certification code.",
        });
      }

      role_id = 3;
    }
    
    if (!qr_code && allowDevelopmentVulnerableSignup) {
      role_id = 3;
    }

    const hashedPassword = await bcrypt.hash(member_pw, 10);
    const [result] = await db.query(
      `INSERT INTO MEMBER (role_id, member_pw, name, email, phone, dong_name, nickname)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [role_id, hashedPassword, name, email, formattedPhone, dong_name, nickname]
    );

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

    const token = jwt.sign(
      {
        member_id: result.insertId,
        email,
        role_id,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    return res.status(201).json({
      success: true,
      message: "Signup completed.",
      data: {
        token,
        user: {
          id: result.insertId,
          memberId: result.insertId,
          member_id: result.insertId,
          name,
          nickname,
          email,
          phone: formattedPhone,
          roleId: role_id,
          role_id,
          dongName: dong_name,
          dong_name,
        },
        member_id: result.insertId,
        email,
        role_id,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred during signup.",
    });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  const member_id = req.user.member_id || req.user.id;

  try {
    const [rows] = await db.query(
      `SELECT member_id, name, nickname, email, phone, role_id, dong_name, created_at
       FROM MEMBER
       WHERE member_id = ?`,
      [member_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Member not found." });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Load member error:", error);
    return res.status(500).json({ message: "Failed to load member information." });
  }
});

const normalizeUploadUrl = (req, imageUrl) => {
  if (!imageUrl) {
    return null;
  }

  const rawUrl = String(imageUrl);
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  const filename = rawUrl.split(/[\\/]/).pop();
  return `${req.protocol}://${req.get("host")}/uploads/${filename}`;
};

router.get("/me/posts", authenticateToken, async (req, res) => {
  const member_id = req.user.member_id || req.user.id;

  try {
    const sql = `
      SELECT
        d.donate_id AS post_id,
        d.title,
        d.content,
        d.status,
        d.created_at,
        'donate' AS post_type,
        MIN(di.image_url) AS image_url
      FROM ITEM_DONATE d
      LEFT JOIN ITEM_DONATE_IMAGE di ON di.donate_id = d.donate_id
      WHERE d.member_id = ?
      GROUP BY d.donate_id, d.title, d.content, d.status, d.created_at

      UNION ALL

      SELECT
        r.request_id AS post_id,
        r.title,
        r.content,
        r.status,
        r.created_at,
        'request' AS post_type,
        MIN(ri.image_url) AS image_url
      FROM ITEM_REQUEST r
      LEFT JOIN ITEM_REQUEST_IMAGE ri ON ri.request_id = r.request_id
      WHERE r.member_id = ?
      GROUP BY r.request_id, r.title, r.content, r.status, r.created_at

      ORDER BY created_at DESC
    `;

    const [rows] = await db.query(sql, [member_id, member_id]);
    const posts = rows.map((row) => ({
      post_id: row.post_id,
      postId: row.post_id,
      post_type: row.post_type,
      postType: row.post_type,
      title: row.title,
      content: row.content,
      status: row.status,
      image_url: normalizeUploadUrl(req, row.image_url),
      image: normalizeUploadUrl(req, row.image_url),
      created_at: row.created_at,
      createdAt: row.created_at,
    }));

    return res.status(200).json({
      success: true,
      data: {
        posts,
        total: posts.length,
      },
      message: "작성한 글 조회에 성공했습니다.",
    });
  } catch (error) {
    console.error("Load my posts error:", error);
    return res.status(500).json({
      success: false,
      message: "작성한 글을 불러오지 못했습니다.",
    });
  }
});

router.get("/me/likes", authenticateToken, async (req, res) => {
  const member_id = req.user.member_id || req.user.id;

  try {
    const sql = `
      SELECT
        d.donate_id AS post_id,
        d.title,
        d.status,
        d.created_at,
        'donate' AS post_type,
        MIN(di.image_url) AS image_url
      FROM DONATE_LIKE dl
      INNER JOIN ITEM_DONATE d ON d.donate_id = dl.donate_id
      LEFT JOIN ITEM_DONATE_IMAGE di ON di.donate_id = d.donate_id
      WHERE dl.member_id = ?
      GROUP BY d.donate_id, d.title, d.status, d.created_at

      UNION ALL

      SELECT
        r.request_id AS post_id,
        r.title,
        r.status,
        r.created_at,
        'request' AS post_type,
        MIN(ri.image_url) AS image_url
      FROM REQUEST_LIKE rl
      INNER JOIN ITEM_REQUEST r ON r.request_id = rl.request_id
      LEFT JOIN ITEM_REQUEST_IMAGE ri ON ri.request_id = r.request_id
      WHERE rl.member_id = ?
      GROUP BY r.request_id, r.title, r.status, r.created_at

      ORDER BY created_at DESC
    `;

    const [rows] = await db.query(sql, [member_id, member_id]);
    const likes = rows.map((row) => ({
      post_id: row.post_id,
      postId: row.post_id,
      post_type: row.post_type,
      postType: row.post_type,
      title: row.title,
      status: row.status,
      image_url: normalizeUploadUrl(req, row.image_url),
      image: normalizeUploadUrl(req, row.image_url),
      created_at: row.created_at,
      createdAt: row.created_at,
    }));

    return res.status(200).json({
      success: true,
      data: {
        likes,
        total: likes.length,
      },
      message: "찜한 글 조회에 성공했습니다.",
    });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return res.status(200).json({
        success: true,
        data: {
          likes: [],
          total: 0,
        },
        message: "찜한 글 조회에 성공했습니다.",
      });
    }

    console.error("Load my likes error:", error);
    return res.status(500).json({
      success: false,
      message: "찜한 글을 불러오지 못했습니다.",
    });
  }
});

router.patch("/me", authenticateToken, async (req, res) => {
  const member_id = req.user.member_id || req.user.id;
  const { name, nickname, email, phone, member_pw, password } = req.body;
  const updateFields = [];
  const queryParams = [];

  try {
    if (name) {
      updateFields.push("name = ?");
      queryParams.push(String(name).trim());
    }

    if (nickname) {
      const nicknameTaken = await isNicknameTaken(nickname, member_id);

      if (nicknameTaken) {
        return res.status(400).json({ message: "Nickname is already in use." });
      }

      updateFields.push("nickname = ?");
      queryParams.push(nickname);
    }

    if (email) {
      const [exist] = await db.query(
        "SELECT member_id FROM MEMBER WHERE email = ? AND member_id != ?",
        [email, member_id]
      );

      if (exist.length > 0) {
        return res.status(400).json({ message: "Email is already in use." });
      }

      updateFields.push("email = ?");
      queryParams.push(email);
    }

    if (phone) {
      const formattedPhone = formatPhoneNumber(phone);
      const [exist] = await db.query(
        "SELECT member_id FROM MEMBER WHERE phone = ? AND member_id != ?",
        [formattedPhone, member_id]
      );

      if (exist.length > 0) {
        return res.status(400).json({ message: "Phone number is already in use." });
      }

      updateFields.push("phone = ?");
      queryParams.push(formattedPhone);
    }

    const nextPassword = member_pw || password;

    if (nextPassword) {
      const pwRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

      if (!pwRegex.test(nextPassword)) {
        return res.status(400).json({
          message: "Password must be at least 8 characters and include a number and special character.",
        });
      }

      const hashedPassword = await bcrypt.hash(nextPassword, 10);
      updateFields.push("member_pw = ?");
      queryParams.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "No profile fields were provided." });
    }

    queryParams.push(member_id);
    const sql = `UPDATE MEMBER SET ${updateFields.join(", ")} WHERE member_id = ?`;
    const [result] = await db.query(sql, queryParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Member not found." });
    }

    const [memberRows] = await db.query(
      `SELECT member_id, name, nickname, email, phone, role_id, dong_name, created_at
       FROM MEMBER
       WHERE member_id = ?`,
      [member_id]
    );

    return res.status(200).json({
      success: true,
      data: memberRows[0],
      message: "Profile updated successfully.",
    });
  } catch (error) {
    console.error("Update member error:", error);
    return res.status(500).json({ message: "Failed to update member information." });
  }
});

router.patch("/me/location", authenticateToken, async (req, res) => {
  const member_id = req.user.member_id || req.user.id;
  const dong_name = req.body.dong_name || req.body.dongName || req.body.location;
  const { latitude, longitude } = req.body;

  if (!dong_name) {
    return res.status(400).json({
      message: "dong_name is required.",
    });
  }

  try {
    const updateFields = ["dong_name = ?"];
    const queryParams = [dong_name];

    if (latitude !== undefined && longitude !== undefined) {
      updateFields.push("latitude = ?", "longitude = ?");
      queryParams.push(latitude, longitude);
    }

    queryParams.push(member_id);

    const [result] = await db.query(
      `UPDATE MEMBER
       SET ${updateFields.join(", ")}
       WHERE member_id = ?`,
      queryParams
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Member not found." });
    }

    return res.status(200).json({
      message: "Location updated successfully.",
      data: {
        dong_name,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
    });
  } catch (error) {
    console.error("Update location error:", error);
    return res.status(500).json({ message: "Failed to update location." });
  }
});

router.delete("/me", authenticateToken, async (req, res) => {
  const member_id = req.user.member_id || req.user.id;

  try {
    const deleted = await deleteMemberWithRelations(member_id);

    if (!deleted) {
      return res.status(404).json({ message: "Member not found." });
    }

    return res.status(200).json({ message: "Member account deleted successfully." });
  } catch (error) {
    console.error("Delete self error:", error);
    return res.status(500).json({ message: "Failed to delete member account." });
  }
});

router.delete(
  "/admin/:member_id",
  authenticateToken,
  requireDevelopmentOnly,
  requireDevDeleteKey,
  async (req, res) => {
    const { member_id } = req.params;

    try {
      const deleted = await deleteMemberWithRelations(member_id);

      if (!deleted) {
        return res.status(404).json({ message: "Member not found." });
      }

      return res.status(200).json({
        success: true,
        message: `Member ${member_id} deleted successfully.`,
      });
    } catch (error) {
      console.error("Admin delete error:", error);
      return res.status(500).json({ message: "Failed to delete member." });
    }
  }
);

router.delete(
  "/dev/cleanup",
  requireDevelopmentOnly,
  requireDevDeleteKey,
  async (req, res) => {
    const { member_id, email, phone } = req.body;

    try {
      if (!member_id && !email && !phone) {
        return res.status(400).json({
          success: false,
          message: "Provide at least one of member_id, email, or phone.",
        });
      }

      let targetMemberId = member_id;

      if (!targetMemberId) {
        const conditions = [];
        const params = [];

        if (email) {
          conditions.push("email = ?");
          params.push(email);
        }

        if (phone) {
          conditions.push("phone = ?");
          params.push(formatPhoneNumber(phone));
        }

        const [members] = await db.query(
          `SELECT member_id FROM MEMBER WHERE ${conditions.join(" OR ")} LIMIT 1`,
          params
        );

        if (members.length === 0) {
          return res.status(404).json({
            success: false,
            message: "No matching member was found.",
          });
        }

        targetMemberId = members[0].member_id;
      }

      const deleted = await deleteMemberWithRelations(targetMemberId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "No matching member was found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Development cleanup removed member ${targetMemberId} and related posts.`,
        data: {
          member_id: targetMemberId,
        },
      });
    } catch (error) {
      console.error("Development cleanup error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to run development cleanup.",
      });
    }
  }
);

module.exports = router;

const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");

const router = express.Router();

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

    return res.status(201).json({
      success: true,
      message: "Signup completed.",
      data: {
        member_id: result.insertId,
        name,
        nickname,
        email,
        phone: formattedPhone,
        role_id,
        dong_name,
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

router.patch("/me", authenticateToken, async (req, res) => {
  const member_id = req.user.member_id || req.user.id;
  const { nickname, email, phone, member_pw } = req.body;
  const updateFields = [];
  const queryParams = [];

  try {
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

    if (member_pw) {
      const pwRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

      if (!pwRegex.test(member_pw)) {
        return res.status(400).json({
          message: "Password must be at least 8 characters and include a number and special character.",
        });
      }

      const hashedPassword = await bcrypt.hash(member_pw, 10);
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

    return res.status(200).json({ message: "Profile updated successfully." });
  } catch (error) {
    console.error("Update member error:", error);
    return res.status(500).json({ message: "Failed to update member information." });
  }
});

router.patch("/me/location", authenticateToken, async (req, res) => {
  const member_id = req.user.member_id || req.user.id;
  const { dong_name, latitude, longitude } = req.body;

  if (!dong_name || !latitude || !longitude) {
    return res.status(400).json({
      message: "dong_name, latitude, and longitude are all required.",
    });
  }

  try {
    const [result] = await db.query(
      `UPDATE MEMBER
       SET dong_name = ?, latitude = ?, longitude = ?
       WHERE member_id = ?`,
      [dong_name, latitude, longitude, member_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Member not found." });
    }

    return res.status(200).json({
      message: "Location updated successfully.",
      data: {
        dong_name,
        latitude,
        longitude,
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

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const db = require("../db");

const ROLE_GENERAL = 1;
const ROLE_VULNERABLE = 3;

const analyzeImageWithAI = async (imageFile) => {
  if (!imageFile) {
    throw new Error("이미지 파일이 필요합니다.");
  }

  const aiServerUrl = process.env.AI_SERVER_URL;

  if (!aiServerUrl) {
    const error = new Error("AI 서버가 아직 연결되지 않았습니다.");
    error.statusCode = 503;
    throw error;
  }

  const form = new FormData();
  form.append("file", fs.createReadStream(imageFile.path), {
    filename: imageFile.originalname,
    contentType: imageFile.mimetype,
  });

  const aiResponse = await axios.post(`${aiServerUrl}/predict`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
  });

  return aiResponse.data;
};

const getAllPosts = async (req, res) => {
  try {
    const sql = `
      SELECT donate_id AS post_id, member_id, title, status, created_at, 'donate' AS post_type
      FROM ITEM_DONATE
      UNION ALL
      SELECT request_id AS post_id, member_id, title, status, created_at, 'request' AS post_type
      FROM ITEM_REQUEST
      ORDER BY created_at DESC
    `;

    const [rows] = await db.query(sql);
    return res.status(200).json(rows);
  } catch (error) {
    console.error("게시글 목록 조회 오류:", error);
    return res.status(500).json({ message: "게시글 목록을 불러오지 못했습니다." });
  }
};

const analyzeImage = async (req, res) => {
  const imageFile = req.file;

  if (!imageFile) {
    return res.status(400).json({ message: "이미지 파일이 필요합니다." });
  }

  try {
    const { is_dangerous, message, ai_guess } = await analyzeImageWithAI(imageFile);

    if (is_dangerous === true) {
      return res.status(400).json({
        message: "유해물품이라 나눔이 불가합니다.",
        ai_reason: message,
      });
    }

    return res.status(200).json({
      message: "등록 가능한 이미지입니다.",
      ai_guess,
      ai_message: message,
    });
  } catch (error) {
    console.error("AI 이미지 분석 오류:", error);
    return res.status(500).json({
      message: error.message || "이미지 분석 중 오류가 발생했습니다.",
    });
  }
};

const createPost = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { title, content, item_name, item_condition, product_id } = req.body;
    const member_id = req.user.member_id || req.user.id;
    const role_id = Number(req.user.role_id);
    const imageFile = req.file;

    if (role_id !== ROLE_GENERAL && role_id !== ROLE_VULNERABLE) {
      return res.status(403).json({ message: "게시글 작성 권한이 없습니다." });
    }

    const isDonate = role_id === ROLE_GENERAL;
    const isRequest = role_id === ROLE_VULNERABLE;

    if (isDonate && !imageFile) {
      return res.status(400).json({
        message: "나눔 게시글은 사진 첨부가 필수입니다.",
      });
    }

    if ((isDonate && imageFile) || (isRequest && imageFile)) {
      const { is_dangerous, message } = await analyzeImageWithAI(imageFile);

      if (is_dangerous === true) {
        return res.status(400).json({
          message: isDonate
            ? "유해물품이라 나눔이 불가합니다."
            : "해당 물품은 유해물품으로 나눔받으실 수 없습니다.",
          ai_reason: message,
        });
      }
    }

    await connection.beginTransaction();

    const [memberRows] = await connection.query(
      `SELECT dong_name, latitude, longitude
       FROM MEMBER
       WHERE member_id = ?`,
      [member_id]
    );

    if (memberRows.length === 0) {
      throw new Error("회원 정보를 찾을 수 없습니다.");
    }

    const { dong_name, latitude, longitude } = memberRows[0];
    const imageUrl = imageFile ? imageFile.path : null;
    let postId;
    let postType;

    if (isDonate) {
      const [postResult] = await connection.query(
        `INSERT INTO ITEM_DONATE (member_id, title, content, dong_name, latitude, longitude, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [member_id, title, content, dong_name, latitude, longitude, "open"]
      );

      postId = postResult.insertId;
      postType = "donate";

      await connection.query(
        `INSERT INTO ITEM_DONATE_IMAGE (donate_id, image_url)
         VALUES (?, ?)`,
        [postId, imageUrl]
      );

      await connection.query(
        `INSERT INTO ITEM (donate_id, product_id, item_name, item_condition)
         VALUES (?, ?, ?, ?)`,
        [postId, product_id, item_name, item_condition]
      );
    } else {
      const [postResult] = await connection.query(
        `INSERT INTO ITEM_REQUEST (member_id, title, content, dong_name, latitude, longitude, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [member_id, title, content, dong_name, latitude, longitude, "open"]
      );

      postId = postResult.insertId;
      postType = "request";

      if (imageUrl) {
        await connection.query(
          `INSERT INTO ITEM_REQUEST_IMAGE (request_id, image_url)
           VALUES (?, ?)`,
          [postId, imageUrl]
        );
      }

      await connection.query(
        `INSERT INTO ITEM (request_id, product_id, item_name, item_condition)
         VALUES (?, ?, ?, ?)`,
        [postId, product_id, item_name, item_condition]
      );
    }

    await connection.commit();

    return res.status(201).json({
      message: "게시글이 성공적으로 등록되었습니다.",
      post_id: postId,
      post_type: postType,
    });
  } catch (error) {
    await connection.rollback();
    console.error("게시글 등록 오류:", error);
    return res.status(500).json({
      message: error.message || "게시글 등록에 실패했습니다.",
    });
  } finally {
    connection.release();
  }
};

const getPostDetail = async (req, res) => {
  const postId = req.params.id;
  const postType = req.query.type;

  try {
    let sql = "";

    if (postType === "donate") {
      sql = `
        SELECT d.*, i.product_id, i.item_name, i.item_condition
        FROM ITEM_DONATE d
        LEFT JOIN ITEM i ON d.donate_id = i.donate_id
        WHERE d.donate_id = ?
      `;
    } else if (postType === "request") {
      sql = `
        SELECT r.*, i.product_id, i.item_name, i.item_condition
        FROM ITEM_REQUEST r
        LEFT JOIN ITEM i ON r.request_id = i.request_id
        WHERE r.request_id = ?
      `;
    } else {
      return res.status(400).json({
        message: "type 쿼리는 donate 또는 request 여야 합니다.",
      });
    }

    const [rows] = await db.query(sql, [postId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error("게시글 상세 조회 오류:", error);
    return res.status(500).json({ message: "게시글 상세 정보를 불러오지 못했습니다." });
  }
};

const updatePost = async (req, res) => {
  const postId = req.params.id;
  const postType = req.query.type;
  const { title, content, item_name, item_condition, product_id } = req.body;
  const member_id = req.user.member_id || req.user.id;

  if (!postType || (postType !== "donate" && postType !== "request")) {
    return res.status(400).json({ message: "type은 donate 또는 request 여야 합니다." });
  }

  try {
    const tableName = postType === "donate" ? "ITEM_DONATE" : "ITEM_REQUEST";
    const idColumn = postType === "donate" ? "donate_id" : "request_id";

    const [checkRows] = await db.query(
      `SELECT member_id FROM ${tableName} WHERE ${idColumn} = ?`,
      [postId]
    );

    if (checkRows.length === 0) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    }

    if (checkRows[0].member_id !== member_id) {
      return res.status(403).json({ message: "수정 권한이 없습니다." });
    }

    await db.query(
      `UPDATE ${tableName}
       SET title = ?, content = ?, updated_at = NOW()
       WHERE ${idColumn} = ?`,
      [title, content, postId]
    );

    await db.query(
      `UPDATE ITEM
       SET product_id = ?, item_name = ?, item_condition = ?
       WHERE ${idColumn} = ?`,
      [product_id, item_name, item_condition, postId]
    );

    return res.status(200).json({ message: "게시글이 수정되었습니다." });
  } catch (error) {
    console.error("게시글 수정 오류:", error);
    return res.status(500).json({ message: "게시글 수정에 실패했습니다." });
  }
};

const deletePost = async (req, res) => {
  const postId = req.params.id;
  const postType = req.query.type;
  const member_id = req.user.member_id || req.user.id;

  if (!postType || (postType !== "donate" && postType !== "request")) {
    return res.status(400).json({ message: "type은 donate 또는 request 여야 합니다." });
  }

  try {
    const tableName = postType === "donate" ? "ITEM_DONATE" : "ITEM_REQUEST";
    const idColumn = postType === "donate" ? "donate_id" : "request_id";
    const imageTableName = postType === "donate" ? "ITEM_DONATE_IMAGE" : "ITEM_REQUEST_IMAGE";

    const [checkRows] = await db.query(
      `SELECT member_id FROM ${tableName} WHERE ${idColumn} = ?`,
      [postId]
    );

    if (checkRows.length === 0) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    }

    if (checkRows[0].member_id !== member_id) {
      return res.status(403).json({ message: "삭제 권한이 없습니다." });
    }

    await db.query(`DELETE FROM ${imageTableName} WHERE ${idColumn} = ?`, [postId]);
    await db.query(`DELETE FROM ITEM WHERE ${idColumn} = ?`, [postId]);
    await db.query(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`, [postId]);

    return res.status(200).json({ message: "게시글이 삭제되었습니다." });
  } catch (error) {
    console.error("게시글 삭제 오류:", error);
    return res.status(500).json({ message: "게시글 삭제에 실패했습니다." });
  }
};

module.exports = {
  getAllPosts,
  analyzeImage,
  createPost,
  getPostDetail,
  updatePost,
  deletePost,
};

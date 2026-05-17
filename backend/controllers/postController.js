const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const db = require("../db");

const ROLE_GENERAL = 1;
const ROLE_VULNERABLE = 3;
const ALLOWED_ITEM_CONDITIONS = new Set([
  "새상품",
  "사용감 적음",
  "사용감 있음",
  "상태 무관",
  "중고 가능",
]);

const normalizeItemCondition = (value) => {
  const normalizedValue = String(value || "").trim();

  if (ALLOWED_ITEM_CONDITIONS.has(normalizedValue)) {
    return normalizedValue;
  }

  return "상태 무관";
};

const resolveAiPostGenerationApiUrl = (rawUrl) => {
  const trimmedUrl = String(rawUrl || "").trim();

  if (!trimmedUrl) {
    const error = new Error("AI 서버가 아직 연결되지 않았습니다.");
    error.statusCode = 503;
    throw error;
  }

  let normalizedUrl = trimmedUrl.replace(/\/+$/, "");

  if (normalizedUrl.endsWith("/api/post/generate-post")) {
    return normalizedUrl;
  }

  if (normalizedUrl.endsWith("/docs")) {
    normalizedUrl = normalizedUrl.slice(0, -"/docs".length);
  }

  return `${normalizedUrl}/api/post/generate-post`;
};

const getUploadedImages = (req) => {
  if (Array.isArray(req.files)) {
    return req.files;
  }

  if (req.files && typeof req.files === "object") {
    return [...(req.files.image || []), ...(req.files.images || [])];
  }

  if (req.file) {
    return [req.file];
  }

  return [];
};

const firstTextValue = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const analyzeImageWithAI = async (imageFile) => {
  if (!imageFile) {
    throw new Error("이미지 파일이 필요합니다.");
  }

  const aiPredictUrl = resolveAiPostGenerationApiUrl(process.env.AI_SERVER_URL);

  const form = new FormData();
  form.append("file1", fs.createReadStream(imageFile.path), {
    filename: imageFile.originalname,
    contentType: imageFile.mimetype,
  });
  form.append("generate_post", "true");
  form.append("write_post", "true");
  form.append("with_post", "true");
  form.append("mode", "write");

  const aiResponse = await axios.post(aiPredictUrl, form, {
    headers: {
      ...form.getHeaders(),
      "ngrok-skip-browser-warning": "true",
    },
    maxBodyLength: Infinity,
  });

  return aiResponse.data;
};

const analyzeImagesWithAI = async (imageFiles) => {
  const results = [];

  for (let index = 0; index < imageFiles.length; index += 1) {
    const imageFile = imageFiles[index];
    const aiResult = await analyzeImageWithAI(imageFile);
    const suggestedTitle = firstTextValue(
      aiResult.suggested_title,
      aiResult.title,
      aiResult.post_title,
      aiResult.generated_title,
    );
    const aiGeneratedPost = firstTextValue(
      aiResult.ai_generated_post,
      aiResult.generated_post,
      aiResult.post,
      aiResult.post_content,
      aiResult.description,
      aiResult.content,
      aiResult.message,
    );

    results.push({
      index,
      filename: imageFile.originalname,
      stored_path: imageFile.path,
      is_dangerous: aiResult.is_dangerous === true,
      is_same_item: aiResult.is_same_item ?? null,
      category: aiResult.category ?? null,
      suggested_title: suggestedTitle,
      extracted_features: Array.isArray(aiResult.extracted_features)
        ? aiResult.extracted_features
        : [],
      ai_generated_post: aiGeneratedPost,
      confidence: aiResult.confidence ?? null,
      ai_guess: aiResult.ai_guess || suggestedTitle || aiResult.category || null,
      ai_message: aiResult.message || aiGeneratedPost || null,
      raw_ai_result: aiResult,
    });
  }

  return results;
};

const insertPostImages = async (connection, tableName, idColumn, postId, imageFiles) => {
  if (!imageFiles.length) {
    return;
  }

  const values = imageFiles.map((file) => [postId, file.path]);
  await connection.query(
    `INSERT INTO ${tableName} (${idColumn}, image_url) VALUES ?`,
    [values],
  );
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
  const imageFiles = getUploadedImages(req);

  if (imageFiles.length === 0) {
    return res.status(400).json({ message: "이미지 파일이 필요합니다." });
  }

  try {
    const analysisResults = await analyzeImagesWithAI(imageFiles);
    const dangerousImages = analysisResults.filter((image) => image.is_dangerous);

    if (dangerousImages.length > 0) {
      return res.status(400).json({
        message: "유해 물품으로 판별된 사진이 있습니다.",
        problematic_images: dangerousImages.map((image) => ({
          index: image.index,
          filename: image.filename,
          ai_reason: image.ai_message,
          ai_guess: image.ai_guess,
          is_same_item: image.is_same_item,
          category: image.category,
          suggested_title: image.suggested_title,
          extracted_features: image.extracted_features,
          ai_generated_post: image.ai_generated_post,
          confidence: image.confidence,
          raw_ai_result: image.raw_ai_result,
        })),
      });
    }

    return res.status(200).json({
      message: "등록 가능한 이미지입니다.",
      analyzed_images: analysisResults.map((image) => ({
        index: image.index,
        filename: image.filename,
        is_same_item: image.is_same_item,
        category: image.category,
        suggested_title: image.suggested_title,
        extracted_features: image.extracted_features,
        ai_generated_post: image.ai_generated_post,
        confidence: image.confidence,
        ai_guess: image.ai_guess,
        ai_message: image.ai_message,
        raw_ai_result: image.raw_ai_result,
      })),
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
    const imageFiles = getUploadedImages(req);
    const normalizedItemCondition = normalizeItemCondition(item_condition);
    const normalizedProductId = product_id || 1;

    if (role_id !== ROLE_GENERAL && role_id !== ROLE_VULNERABLE) {
      return res.status(403).json({ message: "게시글 작성 권한이 없습니다." });
    }

    const isDonate = role_id === ROLE_GENERAL;
    const isRequest = role_id === ROLE_VULNERABLE;

    if (isDonate && imageFiles.length === 0) {
      return res.status(400).json({
        message: "나눔 게시글은 사진 첨부가 필수입니다.",
      });
    }

    if (imageFiles.length > 0) {
      const analysisResults = await analyzeImagesWithAI(imageFiles);
      const dangerousImages = analysisResults.filter((image) => image.is_dangerous);

      if (dangerousImages.length > 0) {
        return res.status(400).json({
          message: isDonate
            ? "유해 물품 사진이 포함되어 나눔 게시글을 등록할 수 없습니다."
            : "유해 물품 사진이 포함되어 요청 게시글을 등록할 수 없습니다.",
          problematic_images: dangerousImages.map((image) => ({
            index: image.index,
            filename: image.filename,
            ai_reason: image.ai_message,
            ai_guess: image.ai_guess,
            is_same_item: image.is_same_item,
            category: image.category,
            suggested_title: image.suggested_title,
            extracted_features: image.extracted_features,
            ai_generated_post: image.ai_generated_post,
            confidence: image.confidence,
            raw_ai_result: image.raw_ai_result,
          })),
        });
      }
    }

    await connection.beginTransaction();

    const [memberRows] = await connection.query(
      `SELECT dong_name, latitude, longitude
       FROM MEMBER
       WHERE member_id = ?`,
      [member_id],
    );

    if (memberRows.length === 0) {
      throw new Error("회원 정보를 찾을 수 없습니다.");
    }

    const { dong_name, latitude, longitude } = memberRows[0];
    let postId;
    let postType;

    if (isDonate) {
      const [postResult] = await connection.query(
        `INSERT INTO ITEM_DONATE (member_id, title, content, dong_name, latitude, longitude, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [member_id, title, content, dong_name, latitude, longitude, "open"],
      );

      postId = postResult.insertId;
      postType = "donate";

      await insertPostImages(
        connection,
        "ITEM_DONATE_IMAGE",
        "donate_id",
        postId,
        imageFiles,
      );

      await connection.query(
        `INSERT INTO ITEM (donate_id, product_id, item_name, item_condition)
         VALUES (?, ?, ?, ?)`,
        [postId, normalizedProductId, item_name, normalizedItemCondition],
      );
    } else if (isRequest) {
      const [postResult] = await connection.query(
        `INSERT INTO ITEM_REQUEST (member_id, title, content, dong_name, latitude, longitude, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [member_id, title, content, dong_name, latitude, longitude, "open"],
      );

      postId = postResult.insertId;
      postType = "request";

      await insertPostImages(
        connection,
        "ITEM_REQUEST_IMAGE",
        "request_id",
        postId,
        imageFiles,
      );

      await connection.query(
        `INSERT INTO ITEM (request_id, product_id, item_name, item_condition)
         VALUES (?, ?, ?, ?)`,
        [postId, normalizedProductId, item_name, normalizedItemCondition],
      );
    }

    await connection.commit();

    return res.status(201).json({
      message: "게시글이 성공적으로 등록되었습니다.",
      post_id: postId,
      post_type: postType,
      image_count: imageFiles.length,
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
        message: "type 쿼리는 donate 또는 request여야 합니다.",
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
  const { title, content, item_name, item_condition, product_id, status } = req.body;
  const member_id = req.user.member_id || req.user.id;
  const normalizedItemCondition = normalizeItemCondition(item_condition);
  const normalizedProductId = product_id || 1;

  if (!postType || (postType !== "donate" && postType !== "request")) {
    return res.status(400).json({ message: "type은 donate 또는 request여야 합니다." });
  }

  try {
    const tableName = postType === "donate" ? "ITEM_DONATE" : "ITEM_REQUEST";
    const idColumn = postType === "donate" ? "donate_id" : "request_id";

    const [checkRows] = await db.query(
      `SELECT member_id FROM ${tableName} WHERE ${idColumn} = ?`,
      [postId],
    );

    if (checkRows.length === 0) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    }

    if (checkRows[0].member_id !== member_id) {
      return res.status(403).json({ message: "수정 권한이 없습니다." });
    }

    const postUpdateFields = [];
    const postUpdateParams = [];

    if (title !== undefined) {
      postUpdateFields.push("title = ?");
      postUpdateParams.push(title);
    }

    if (content !== undefined) {
      postUpdateFields.push("content = ?");
      postUpdateParams.push(content);
    }

    if (status !== undefined) {
      postUpdateFields.push("status = ?");
      postUpdateParams.push(status);
    }

    if (postUpdateFields.length > 0) {
      postUpdateParams.push(postId);
      await db.query(
        `UPDATE ${tableName}
         SET ${postUpdateFields.join(", ")}, updated_at = NOW()
         WHERE ${idColumn} = ?`,
        postUpdateParams,
      );
    }

    const itemUpdateFields = [];
    const itemUpdateParams = [];

    if (product_id !== undefined) {
      itemUpdateFields.push("product_id = ?");
      itemUpdateParams.push(normalizedProductId);
    }

    if (item_name !== undefined) {
      itemUpdateFields.push("item_name = ?");
      itemUpdateParams.push(item_name);
    }

    if (item_condition !== undefined) {
      itemUpdateFields.push("item_condition = ?");
      itemUpdateParams.push(normalizedItemCondition);
    }

    if (itemUpdateFields.length > 0) {
      itemUpdateParams.push(postId);
      await db.query(
        `UPDATE ITEM
         SET ${itemUpdateFields.join(", ")}
         WHERE ${idColumn} = ?`,
        itemUpdateParams,
      );
    }

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
    return res.status(400).json({ message: "type은 donate 또는 request여야 합니다." });
  }

  try {
    const tableName = postType === "donate" ? "ITEM_DONATE" : "ITEM_REQUEST";
    const idColumn = postType === "donate" ? "donate_id" : "request_id";
    const imageTableName =
      postType === "donate" ? "ITEM_DONATE_IMAGE" : "ITEM_REQUEST_IMAGE";

    const [checkRows] = await db.query(
      `SELECT member_id FROM ${tableName} WHERE ${idColumn} = ?`,
      [postId],
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

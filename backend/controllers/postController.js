const axios = require("axios");
const { v2: cloudinary } = require("cloudinary");
const FormData = require("form-data");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const {
  resolveAiEndpointUrls,
} = require("../lib/aiServerUrls");
const { getStorageBucket } = require("../lib/firebaseAdmin");
const { buildUploadUrl } = require("../lib/uploadUrl");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ROLE_GENERAL = 1;
const ROLE_VULNERABLE = 3;
const DEFAULT_PRODUCT_ID = 51;
const AI_REQUEST_TIMEOUT_MS = 30000;
const AI_RETRY_DELAY_MS = 1000;
const DONATION_REQUESTABLE_STATUS = "open";
const DONATION_RESERVED_STATUS = "reserved";
const DONATION_STORED_STATUS = "stored";
const DONATION_PICKUP_REQUESTABLE_STATUSES = new Set([
  DONATION_REQUESTABLE_STATUS,
  DONATION_STORED_STATUS,
]);
const CATEGORY_PRODUCT_ID_MAP = {
  clothing: 1,
  clothes: 1,
  의류: 1,
  "의류/잡화": 1,
  electronics: 2,
  electronic: 2,
  digital: 2,
  전자제품: 2,
  디지털: 2,
  디지털기기: 2,
  "디지털/소형가전": 2,
  household: 51,
  kitchen: 51,
  baby: 51,
  생활용품: 51,
  주방용품: 51,
  "생활/주방용품": 51,
  육아용품: 51,
  "유아동/장난감": 51,
  "위생/생필품": 51,
  "문구/학용품": 106,
  "건강/의료기구": 51,
  furniture: 91,
  가구: 91,
  "가구/인테리어": 91,
  books: 106,
  book: 106,
  도서: 106,
  "도서/문구": 106,
  "도서/음반": 106,
  가공식품: 51,
  other: 106,
  기타: 106,
};
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

const resolveAiPostGenerationApiUrls = () => {
  return resolveAiEndpointUrls({
    endpointPath: "/api/post/generate-post",
    missingMessage:
      "AI 서버가 아직 연결되지 않았습니다. 로컬 AI 서버를 Render 백엔드에서 사용하려면 ngrok 또는 Cloudflare Tunnel 공개 주소를 AI_SERVER_URL에 설정해주세요.",
  });
};

const parseNumericId = (value) => {
  const normalizedValue = String(value || "").trim();
  if (!/^\d+$/.test(normalizedValue)) {
    return null;
  }

  const parsed = Number(normalizedValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const resolveProductId = async (connection, productId, category) => {
  const normalizedProductId = String(productId || "").trim();
  const directProductId = parseNumericId(productId);

  if (directProductId) {
    const [rows] = await connection.query(
      "SELECT product_id FROM PRODUCT WHERE product_id = ? LIMIT 1",
      [directProductId],
    );

    if (rows.length > 0) {
      return directProductId;
    }
  }

  const normalizedCategory = String(category || productId || "").trim();
  const mappedProductId = CATEGORY_PRODUCT_ID_MAP[normalizedCategory];

  if (mappedProductId) {
    return mappedProductId;
  }

  if (normalizedCategory) {
    const [rows] = await connection.query(
      "SELECT product_id FROM PRODUCT WHERE category = ? OR product_name = ? ORDER BY product_id LIMIT 1",
      [normalizedCategory, normalizedCategory],
    );

    if (rows.length > 0) {
      return rows[0].product_id;
    }
  }

  return DEFAULT_PRODUCT_ID;
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

const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );

const isFirebaseStorageConfigured = () =>
  Boolean(process.env.FIREBASE_STORAGE_BUCKET);

const buildFirebaseDownloadUrl = (bucketName, destination, token) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(destination)}?alt=media&token=${token}`;

const uploadImagesToFirebaseStorage = async (imageFiles) => {
  const bucket = getStorageBucket();

  return Promise.all(
    imageFiles.map(async (file) => {
      const token = crypto.randomUUID();
      const ext =
        path.extname(file.originalname || file.filename || "") || ".jpg";
      const rawBaseName = path.basename(
        file.originalname || file.filename || "post-image",
        ext,
      );
      const safeBaseName =
        rawBaseName.replace(/[^\w.-]+/g, "-").slice(0, 60) || "post-image";
      const destination = `give-app/posts/${Date.now()}-${crypto.randomUUID()}-${safeBaseName}${ext}`;

      await bucket.upload(file.path, {
        destination,
        metadata: {
          contentType: file.mimetype || "image/jpeg",
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      });

      return buildFirebaseDownloadUrl(bucket.name, destination, token);
    }),
  );
};

const buildLocalUploadPaths = (imageFiles) =>
  imageFiles.map(
    (file) => `/uploads/${file.filename || file.path.split(/[\\/]/).pop()}`,
  );

const isRecoverableImageStorageError = (error) => {
  const status = error?.status || error?.response?.status || error?.http_code;
  const code = error?.code || error?.errno;
  const responseText =
    typeof error?.response?.data === "string"
      ? error.response.data
      : JSON.stringify(error?.response?.data || {});
  const message = `${error?.message || ""} ${responseText}`.toLowerCase();

  return (
    code === "FIREBASE_STORAGE_CONFIG_INVALID" ||
    ["ECONNRESET", "ECONNREFUSED", "ECONNABORTED", "ETIMEDOUT", "ENOTFOUND"].includes(code) ||
    [401, 403, 404, 408, 429, 500, 502, 503, 504].includes(status) ||
    (message.includes("bucket") && (message.includes("not") || message.includes("invalid"))) ||
    message.includes("cloudinary") ||
    message.includes("firebase")
  );
};

const removeLocalUploadedFiles = async (imageFiles) => {
  await Promise.all(
    imageFiles.map(async (file) => {
      if (!file?.path) {
        return;
      }

      try {
        await fs.promises.unlink(file.path);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.warn(
            "Uploaded temp file cleanup failed:",
            file.path,
            error.message,
          );
        }
      }
    }),
  );
};

const uploadPostImages = async (imageFiles, options = {}) => {
  if (!imageFiles.length) {
    return [];
  }

  if (isCloudinaryConfigured()) {
    try {
      const uploadedImages = await Promise.all(
        imageFiles.map((file) =>
          cloudinary.uploader.upload(file.path, {
            folder: "give-app/posts",
            resource_type: "image",
          }),
        ),
      );

      return uploadedImages.map((image) => image.secure_url);
    } catch (error) {
      if (!isRecoverableImageStorageError(error)) {
        throw error;
      }

      console.warn(
        "Cloudinary image upload failed. Falling back to local upload paths for this post.",
        error.message,
      );
      options.onLocalFallback?.();
      return buildLocalUploadPaths(imageFiles);
    }
  }

  if (isFirebaseStorageConfigured()) {
    try {
      return await uploadImagesToFirebaseStorage(imageFiles);
    } catch (error) {
      if (!isRecoverableImageStorageError(error)) {
        throw error;
      }

      console.warn(
        "Firebase Storage image upload failed. Falling back to local upload paths for this post.",
        error.message,
      );
      options.onLocalFallback?.();
      return buildLocalUploadPaths(imageFiles);
    }
  }

  if (!isCloudinaryConfigured()) {
    console.warn(
      "Cloudinary is not configured. Falling back to local upload paths.",
    );
    options.onLocalFallback?.();
    return buildLocalUploadPaths(imageFiles);
  }
};

const firstTextValue = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientAiError = (error) => {
  const status = error.response?.status;
  return (
    !error.response ||
    ["ECONNRESET", "ECONNREFUSED", "ECONNABORTED", "ETIMEDOUT"].includes(
      error.code,
    ) ||
    [500, 502, 503, 504].includes(status)
  );
};

const canFailOverAiError = (error) =>
  isTransientAiError(error) || error.response?.status === 404;

const summarizeAiErrorResponse = (responseData) =>
  typeof responseData === "string" ? responseData.slice(0, 500) : responseData;

const logAiRequestError = ({ url, attempt, startedAt, error }) => {
  console.error("AI image request failed", {
    url,
    attempt,
    durationMs: Date.now() - startedAt,
    code: error.code || null,
    status: error.response?.status || null,
    response: summarizeAiErrorResponse(error.response?.data) || null,
    message: error.message,
  });
};

const callAiPostGeneration = async (imageFiles, hints = {}) => {
  if (!imageFiles.length) {
    throw new Error("이미지 파일이 필요합니다.");
  }

  const aiPredictUrls = resolveAiPostGenerationApiUrls();
  let lastError = null;
  const filesForAi = imageFiles.slice(0, 5);

  for (let urlIndex = 0; urlIndex < aiPredictUrls.length; urlIndex += 1) {
    const aiPredictUrl = aiPredictUrls[urlIndex];

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const form = new FormData();
      filesForAi.forEach((imageFile, index) => {
        if (!imageFile?.path || !fs.existsSync(imageFile.path)) {
          const error = new Error("업로드된 이미지 파일을 읽을 수 없습니다.");
          error.statusCode = 400;
          throw error;
        }

        form.append(`file${index + 1}`, fs.createReadStream(imageFile.path), {
          filename: imageFile.originalname,
          contentType: imageFile.mimetype,
        });
      });
      const itemNameHint = firstTextValue(
        hints.itemName,
        hints.item_name,
        hints.title,
      );
      if (itemNameHint) {
        form.append("item_name", itemNameHint);
      }

      const startedAt = Date.now();
      try {
        const aiResponse = await axios.post(aiPredictUrl, form, {
          headers: {
            ...form.getHeaders(),
            "ngrok-skip-browser-warning": "true",
          },
          proxy: false,
          timeout: AI_REQUEST_TIMEOUT_MS,
          maxBodyLength: Infinity,
        });

        return aiResponse.data;
      } catch (error) {
        lastError = error;
        logAiRequestError({
          url: aiPredictUrl,
          attempt,
          startedAt,
          error,
        });

        if (attempt < 2 && isTransientAiError(error)) {
          await sleep(AI_RETRY_DELAY_MS);
          continue;
        }

        const hasFallback = urlIndex < aiPredictUrls.length - 1;
        if (hasFallback && canFailOverAiError(error)) {
          break;
        }

        throw error;
      }
    }
  }

  throw lastError || new Error("AI 이미지 분석 응답을 받을 수 없습니다.");
};

const isAiConnectionError = (error) =>
  error.statusCode === 503 ||
  error.code === "ECONNREFUSED" ||
  error.code === "ECONNRESET" ||
  error.code === "EAI_AGAIN" ||
  error.code === "ENETUNREACH" ||
  error.code === "EHOSTUNREACH" ||
  error.code === "EPIPE" ||
  error.code === "ENOTFOUND" ||
  (!error.response && Boolean(error.request));

const isAiTimeoutError = (error) =>
  error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";

const analyzeImagesWithAI = async (imageFiles, hints = {}) => {
  const aiResult = await callAiPostGeneration(imageFiles, hints);
  if (!isObject(aiResult)) {
    const error = new Error("AI 서버 응답 형식이 올바르지 않습니다.");
    error.statusCode = 502;
    throw error;
  }

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
  const commonResult = {
    is_dangerous:
      aiResult.is_dangerous === true || aiResult.is_safe === false,
    is_same_item: aiResult.is_same_item ?? null,
    category: aiResult.category ?? null,
    suggested_title: suggestedTitle,
    extracted_features: Array.isArray(aiResult.extracted_features)
      ? aiResult.extracted_features
      : [],
    ai_generated_post: aiGeneratedPost,
    confidence: aiResult.confidence ?? null,
    ai_guess: aiResult.ai_guess || suggestedTitle || aiResult.category || null,
    ai_message:
      aiResult.rejection_reason || aiResult.message || aiGeneratedPost || null,
    raw_ai_result: aiResult,
  };

  return {
    ...commonResult,
    analyzed_images: imageFiles.map((imageFile, index) => ({
      index,
      filename: imageFile.originalname,
      stored_path: imageFile.path,
      ...commonResult,
    })),
  };
};

const insertPostImages = async (
  connection,
  tableName,
  idColumn,
  postId,
  imageUrls,
) => {
  if (!imageUrls.length) {
    return;
  }

  const values = imageUrls.map((imageUrl) => [postId, imageUrl]);
  await connection.query(
    `INSERT INTO ${tableName} (${idColumn}, image_url) VALUES ?`,
    [values],
  );
};

const deleteIfTableExists = async (connection, sql, params) => {
  try {
    await connection.query(sql, params);
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      throw error;
    }
  }
};

const rollbackQuietly = async (connection) => {
  if (!connection) {
    return;
  }

  try {
    await connection.rollback();
  } catch (error) {
    console.warn("Database rollback failed:", error.message);
  }
};

const normalizeUploadUrl = (req, imageUrl) => {
  return buildUploadUrl(req, imageUrl);
};

const getAllPosts = async (req, res) => {
  try {
    const requestedDongName = String(
      req.query.dongName ||
        req.query.dong_name ||
        req.query.neighborhood ||
        req.query.location ||
        "",
    ).trim();
    const sql = `
      SELECT
        d.donate_id AS post_id,
        CONCAT('donate_', d.donate_id) AS id,
        d.member_id,
        m.name AS author_name,
        m.nickname AS author_nickname,
        d.title,
        d.content,
        d.dong_name,
        d.latitude,
        d.longitude,
        d.status,
        d.created_at,
        d.updated_at,
        i.product_id,
        i.item_name,
        i.item_condition,
        p.category,
        MIN(di.image_url) AS image_url,
        'app' AS created_from,
        'donate' AS post_type
      FROM ITEM_DONATE d
      LEFT JOIN MEMBER m ON m.member_id = d.member_id
      LEFT JOIN ITEM i ON i.donate_id = d.donate_id
      LEFT JOIN PRODUCT p ON p.product_id = i.product_id
      LEFT JOIN ITEM_DONATE_IMAGE di ON di.donate_id = d.donate_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM PICKUP_REQUEST internal_pickup
        WHERE internal_pickup.donate_id = d.donate_id
          AND internal_pickup.memo LIKE '요청글 나눔 의사 자동 연결%'
      )
      GROUP BY
        d.donate_id, d.member_id, m.name, m.nickname, d.title, d.content,
        d.dong_name, d.latitude, d.longitude, d.status, d.created_at, d.updated_at,
        i.product_id, i.item_name, i.item_condition, p.category

      UNION ALL

      SELECT
        r.request_id AS post_id,
        CONCAT('request_', r.request_id) AS id,
        r.member_id,
        m.name AS author_name,
        m.nickname AS author_nickname,
        r.title,
        r.content,
        r.dong_name,
        r.latitude,
        r.longitude,
        r.status,
        r.created_at,
        r.updated_at,
        i.product_id,
        i.item_name,
        i.item_condition,
        p.category,
        MIN(ri.image_url) AS image_url,
        COALESCE(r.created_from, 'app') AS created_from,
        'request' AS post_type
      FROM ITEM_REQUEST r
      LEFT JOIN MEMBER m ON m.member_id = r.member_id
      LEFT JOIN ITEM i ON i.request_id = r.request_id
      LEFT JOIN PRODUCT p ON p.product_id = i.product_id
      LEFT JOIN ITEM_REQUEST_IMAGE ri ON ri.request_id = r.request_id
      GROUP BY
        r.request_id, r.member_id, m.name, m.nickname, r.title, r.content,
        r.dong_name, r.latitude, r.longitude, r.status, r.created_at, r.updated_at,
        i.product_id, i.item_name, i.item_condition, p.category, r.created_from

      ORDER BY created_at DESC
    `;

    const [rows] = await db.query(sql);
    const reputation = await require('../services/reviews').scores(rows.map(row => row.member_id));
    const posts = rows.map((row) => {
      const imageUrl = normalizeUploadUrl(req, row.image_url);

      return {
        id: row.id,
        post_id: row.post_id,
        postId: row.post_id,
        recordId: row.post_id,
        post_type: row.post_type,
        postType: row.post_type,
        type: row.post_type,
        member_id: row.member_id,
        memberId: row.member_id,
        author: {
          id: row.member_id,
          member_id: row.member_id,
          name: row.author_name,
          nickname: row.author_nickname,
          temperature: reputation[row.member_id]?.score ?? 36.5,
        },
        title: row.title,
        content: row.content,
        description: row.content,
        category: row.category,
        product_id: row.product_id,
        productId: row.product_id,
        item_name: row.item_name,
        itemName: row.item_name,
        item_condition: row.item_condition,
        itemCondition: row.item_condition,
        dong_name: row.dong_name,
        dongName: row.dong_name,
        location: {
          dongName: row.dong_name,
          neighborhood: row.dong_name,
          latitude: row.latitude,
          longitude: row.longitude,
        },
        latitude: row.latitude,
        longitude: row.longitude,
        status: row.status,
        created_from: row.created_from,
        createdFrom: row.created_from,
        image_url: imageUrl,
        imageUrl,
        image: imageUrl,
        images: imageUrl ? [imageUrl] : [],
        created_at: row.created_at,
        createdAt: row.created_at,
        updated_at: row.updated_at,
        updatedAt: row.updated_at,
      };
    });

    const filteredPosts = requestedDongName
      ? posts.filter((post) => post.dong_name === requestedDongName)
      : posts;

    return res.status(200).json(filteredPosts);
  } catch (error) {
    console.error("게시글 목록 조회 오류:", error);
    return res
      .status(500)
      .json({ message: "게시글 목록을 불러오지 못했습니다." });
  }
};

const analyzeImage = async (req, res) => {
  const imageFiles = getUploadedImages(req);

  if (imageFiles.length === 0) {
    return res.status(400).json({ message: "이미지 파일이 필요합니다." });
  }

  try {
    const analysisResult = await analyzeImagesWithAI(imageFiles, {
      itemName: req.body.item_name,
      title: req.body.title,
      description: req.body.description,
    });
    const analysisResults = analysisResult.analyzed_images;
    const problematicImages = analysisResults.filter(
      (image) => image.is_dangerous || image.is_same_item === false,
    );

    if (problematicImages.length > 0) {
      return res.status(400).json({
        message: "등록할 수 없는 사진이 있습니다.",
        problematic_images: problematicImages.map((image) => ({
          index: image.index,
          filename: image.filename,
          is_dangerous: image.is_dangerous,
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
      is_dangerous: analysisResult.is_dangerous,
      is_safe: !analysisResult.is_dangerous,
      is_same_item: analysisResult.is_same_item,
      category: analysisResult.category,
      suggested_title: analysisResult.suggested_title,
      extracted_features: analysisResult.extracted_features,
      ai_generated_post: analysisResult.ai_generated_post,
      confidence: analysisResult.confidence,
      ai_guess: analysisResult.ai_guess,
      ai_message: analysisResult.ai_message,
      raw_ai_result: analysisResult.raw_ai_result,
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
    if (isAiTimeoutError(error)) {
      return res.status(504).json({
        message: "AI 서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.",
      });
    }

    if (isAiConnectionError(error)) {
      return res.status(503).json({
        message:
          "AI 서버에 연결할 수 없습니다. AI 서버 실행 상태를 확인해주세요.",
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message || "AI 이미지 분석을 처리하지 못했습니다.",
      });
    }

    if (error.response) {
      const status = error.response.status;
      const aiMessage =
        error.response.data?.detail ||
        error.response.data?.message ||
        `AI 서버 요청이 실패했습니다. (HTTP ${status})`;

      if ([400, 413, 422, 429].includes(status)) {
        return res.status(status).json({ message: aiMessage });
      }

      return res.status(502).json({
        message: `AI 서버 요청이 실패했습니다. (HTTP ${status})`,
      });
    }

    console.error("AI 이미지 분석 오류:", error);
    return res.status(500).json({
      message: error.message || "이미지 분석 중 오류가 발생했습니다.",
    });
  } finally {
    await removeLocalUploadedFiles(imageFiles);
  }
};

const createPost = async (req, res) => {
  const imageFiles = getUploadedImages(req);
  let connection;
  let transactionStarted = false;
  let committed = false;
  let usedLocalUploadFallback = false;

  try {
    connection = await db.getConnection();

    const { title, content, item_name, item_condition, product_id, category } =
      req.body;
    const titleText = firstTextValue(title);
    const contentText = typeof content === "string" ? content.trim() : "";
    const itemNameText = firstTextValue(item_name, titleText);
    const createdFromValue = String(
      req.body.createdFrom || req.body.created_from || "app",
    )
      .trim()
      .toLowerCase();
    const createdFrom = createdFromValue === "web" ? "web" : "app";
    const member_id = req.user.member_id || req.user.id;
    const role_id = Number(req.user.role_id);
    let uploadedImageUrls = [];
    const normalizedItemCondition = normalizeItemCondition(item_condition);

    if (!titleText) {
      return res.status(400).json({ message: "게시글 제목을 입력해주세요." });
    }

    if (titleText.length > 120) {
      return res.status(400).json({ message: "게시글 제목은 120자 이하로 입력해주세요." });
    }

    if (contentText.length > 3000) {
      return res.status(400).json({ message: "게시글 내용은 3000자 이하로 입력해주세요." });
    }

    const normalizedProductId = await resolveProductId(
      connection,
      product_id,
      category,
    );

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

    await connection.beginTransaction();
    transactionStarted = true;

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
    uploadedImageUrls = await uploadPostImages(imageFiles, {
      onLocalFallback: () => {
        usedLocalUploadFallback = true;
      },
    });

    if (isDonate) {
      const [postResult] = await connection.query(
        `INSERT INTO ITEM_DONATE (member_id, title, content, dong_name, latitude, longitude, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [member_id, titleText, contentText, dong_name, latitude, longitude, "open"],
      );

      postId = postResult.insertId;
      postType = "donate";

      await insertPostImages(
        connection,
        "ITEM_DONATE_IMAGE",
        "donate_id",
        postId,
        uploadedImageUrls,
      );

      await connection.query(
        `INSERT INTO ITEM (donate_id, product_id, item_name, item_condition)
         VALUES (?, ?, ?, ?)`,
        [postId, normalizedProductId, itemNameText, normalizedItemCondition],
      );
    } else if (isRequest) {
      const [postResult] = await connection.query(
        `INSERT INTO ITEM_REQUEST (member_id, title, content, dong_name, latitude, longitude, status, created_from)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          member_id,
          titleText,
          contentText || null,
          dong_name,
          latitude,
          longitude,
          "open",
          createdFrom,
        ],
      );

      postId = postResult.insertId;
      postType = "request";

      await insertPostImages(
        connection,
        "ITEM_REQUEST_IMAGE",
        "request_id",
        postId,
        uploadedImageUrls,
      );

      await connection.query(
        `INSERT INTO ITEM (request_id, product_id, item_name, item_condition)
         VALUES (?, ?, ?, ?)`,
        [postId, normalizedProductId, itemNameText, normalizedItemCondition],
      );
    }

    await connection.commit();
    committed = true;

    const responseImageUrls = uploadedImageUrls.map((imageUrl) =>
      normalizeUploadUrl(req, imageUrl),
    );

    return res.status(201).json({
      message: "게시글이 성공적으로 등록되었습니다.",
      id: `${postType}_${postId}`,
      post_id: postId,
      postId,
      recordId: postId,
      post_type: postType,
      postType: postType,
      type: postType,
      member_id,
      memberId: member_id,
      author: { id: member_id },
      created_from: postType === "request" ? createdFrom : "app",
      createdFrom: postType === "request" ? createdFrom : "app",
      image_count: responseImageUrls.length,
      image_urls: responseImageUrls,
      imageUrls: responseImageUrls,
      images: responseImageUrls,
      image: responseImageUrls[0] || null,
      image_url: responseImageUrls[0] || null,
      imageUrl: responseImageUrls[0] || null,
    });
  } catch (error) {
    if (transactionStarted && !committed) {
      await rollbackQuietly(connection);
    }
    console.error("게시글 등록 오류:", error);
    return res.status(500).json({
      message: error.message || "게시글 등록에 실패했습니다.",
    });
  } finally {
    const shouldPreserveLocalFallbackFiles = usedLocalUploadFallback && committed;
    if (
      (isCloudinaryConfigured() || isFirebaseStorageConfigured()) &&
      !shouldPreserveLocalFallbackFiles
    ) {
      await removeLocalUploadedFiles(imageFiles);
    }
    if (connection) {
      connection.release();
    }
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

    const post = rows[0];
    const imageTableName =
      postType === "donate" ? "ITEM_DONATE_IMAGE" : "ITEM_REQUEST_IMAGE";
    const idColumn = postType === "donate" ? "donate_id" : "request_id";
    const [imageRows] = await db.query(
      `SELECT image_url FROM ${imageTableName} WHERE ${idColumn} = ?`,
      [postId],
    );
    const images = imageRows
      .map((row) => normalizeUploadUrl(req, row.image_url))
      .filter(Boolean);

    return res.status(200).json({
      ...post,
      createdFrom: post.created_from || "app",
      created_from: post.created_from || "app",
      images,
      image: images[0] || null,
      image_url: images[0] || null,
      imageUrl: images[0] || null,
      image_urls: images,
      imageUrls: images,
    });
  } catch (error) {
    console.error("게시글 상세 조회 오류:", error);
    return res
      .status(500)
      .json({ message: "게시글 상세 정보를 불러오지 못했습니다." });
  }
};

const createPickupRequest = async (req, res) => {
  const donateId = req.params.id;
  const requesterId = req.user.member_id || req.user.id;
  const { date, time, memo } = req.body;

  if (!date || !time) {
    return res.status(400).json({
      success: false,
      message: "Pickup date and time are required.",
    });
  }

  let connection;
  let transactionStarted = false;
  let committed = false;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [donationRows] = await connection.query(
      `SELECT donate_id, member_id, title, status
       FROM ITEM_DONATE
       WHERE donate_id = ?
       FOR UPDATE`,
      [donateId],
    );
    const donation = donationRows[0];

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: "Donation post was not found.",
      });
    }

    if (Number(donation.member_id) === Number(requesterId)) {
      return res.status(409).json({
        success: false,
        message: "You cannot request pickup for your own donation post.",
      });
    }

    const [activePickupRows] = await connection.query(
      `SELECT pickup_id, requester_id, request_status
       FROM PICKUP_REQUEST
       WHERE donate_id = ?
         AND request_status IN ('pending', 'approved')
       FOR UPDATE`,
      [donation.donate_id],
    );
    const existingPickupForRequester = activePickupRows.find(
      (row) => Number(row.requester_id) === Number(requesterId),
    );

    if (existingPickupForRequester) {
      return res.status(200).json({
        success: true,
        message: "이미 진행 중인 수령 요청이 있습니다.",
        data: {
          pickupRequestId: existingPickupForRequester.pickup_id,
          pickup_request_id: existingPickupForRequester.pickup_id,
          donateId: donation.donate_id,
          donate_id: donation.donate_id,
          status: donation.status,
          requestStatus: existingPickupForRequester.request_status,
          request_status: existingPickupForRequester.request_status,
          alreadyExists: true,
          already_exists: true,
        },
      });
    }

    if (activePickupRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "이미 다른 사용자의 수령 요청이 진행 중입니다.",
        data: {
          donateId: donation.donate_id,
          donate_id: donation.donate_id,
          status: donation.status,
        },
      });
    }

    if (!DONATION_PICKUP_REQUESTABLE_STATUSES.has(donation.status)) {
      return res.status(409).json({
        success: false,
        message: "현재 수령 요청을 할 수 있는 나눔글 상태가 아닙니다.",
        data: {
          donateId: donation.donate_id,
          donate_id: donation.donate_id,
          status: donation.status,
        },
      });
    }

    const [pickupResult] = await connection.query(
      `INSERT INTO PICKUP_REQUEST
        (requester_id, donate_id, request_status, requested_date, requested_time, memo, requested_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [requesterId, donation.donate_id, "pending", date, time, memo || null],
    );

    const nextDonationStatus =
      donation.status === DONATION_STORED_STATUS
        ? DONATION_STORED_STATUS
        : DONATION_RESERVED_STATUS;

    if (nextDonationStatus !== donation.status) {
      await connection.query(
        `UPDATE ITEM_DONATE
         SET status = ?, updated_at = NOW()
         WHERE donate_id = ?`,
        [nextDonationStatus, donation.donate_id],
      );
    }

    await connection.query(
      `INSERT INTO NOTIFICATION
        (member_id, related_type, related_id, notification_type, message, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, FALSE, NOW())`,
      [
        donation.member_id,
        "pickup",
        pickupResult.insertId,
        "pickup_request",
        `‘${donation.title || "나눔 물품"}’ 물품 수령 요청이 도착했습니다. 앱에서 수락해야 보관함을 열 수 있습니다.`,
      ],
    );

    await connection.commit();
    committed = true;

    return res.status(201).json({
      success: true,
      message: "Pickup request was created.",
      data: {
        pickupRequestId: pickupResult.insertId,
        pickup_request_id: pickupResult.insertId,
        donateId: donation.donate_id,
        donate_id: donation.donate_id,
        status: nextDonationStatus,
      },
    });
  } catch (error) {
    console.error("Pickup request creation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create pickup request.",
    });
  } finally {
    if (transactionStarted && !committed) {
      await rollbackQuietly(connection);
    }
    if (connection) {
      connection.release();
    }
  }
};

const updatePost = async (req, res) => {
  const postId = req.params.id;
  const {
    title,
    content,
    item_name,
    item_condition,
    product_id,
    category,
    status,
  } = req.body;
  const postType =
    req.query.type ||
    req.body.post_type ||
    (req.body.type === "share"
      ? "donate"
      : req.body.type === "need"
        ? "request"
        : req.body.type);
  const member_id = req.user.member_id || req.user.id;
  const normalizedItemCondition = normalizeItemCondition(item_condition);

  if (!postType || (postType !== "donate" && postType !== "request")) {
    return res
      .status(400)
      .json({ message: "type은 donate 또는 request여야 합니다." });
  }

  let connection;
  let transactionStarted = false;
  let committed = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const tableName = postType === "donate" ? "ITEM_DONATE" : "ITEM_REQUEST";
    const idColumn = postType === "donate" ? "donate_id" : "request_id";

    const [checkRows] = await connection.query(
      `SELECT member_id, status FROM ${tableName} WHERE ${idColumn} = ? FOR UPDATE`,
      [postId],
    );

    if (checkRows.length === 0) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    }

    if (checkRows[0].member_id !== member_id) {
      return res.status(403).json({ message: "수정 권한이 없습니다." });
    }

    if (postType === 'donate' && status !== undefined && status !== checkRows[0].status) {
      const [trades] = await connection.query(`SELECT pickup_id FROM PICKUP_REQUEST
        WHERE donate_id = ? AND chat_room_id IS NOT NULL
          AND request_status IN ('pending', 'approved', 'completed') LIMIT 1`, [postId]);
      if (trades.length) return res.status(409).json({ message: '채팅방의 나눔 요청 카드에서 거래 상태를 변경해주세요.' });
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
      await connection.query(
        `UPDATE ${tableName}
         SET ${postUpdateFields.join(", ")}, updated_at = NOW()
         WHERE ${idColumn} = ?`,
        postUpdateParams,
      );
    }

    const itemUpdateFields = [];
    const itemUpdateParams = [];

    if (product_id !== undefined) {
      const normalizedProductId = await resolveProductId(
        connection,
        product_id,
        category,
      );
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
      await connection.query(
        `UPDATE ITEM
         SET ${itemUpdateFields.join(", ")}
         WHERE ${idColumn} = ?`,
        itemUpdateParams,
      );
    }

    await connection.commit();
    committed = true;
    return res.status(200).json({ message: "게시글이 수정되었습니다." });
  } catch (error) {
    console.error("게시글 수정 오류:", error);
    return res.status(500).json({ message: "게시글 수정에 실패했습니다." });
  } finally {
    if (transactionStarted && !committed) {
      await rollbackQuietly(connection);
    }
    if (connection) {
      connection.release();
    }
  }
};

const deletePost = async (req, res) => {
  const postId = req.params.id;
  const postType = req.query.type;
  const member_id = req.user.member_id || req.user.id;

  if (!postType || (postType !== "donate" && postType !== "request")) {
    return res
      .status(400)
      .json({ message: "type은 donate 또는 request여야 합니다." });
  }

  let connection;
  let transactionStarted = false;
  let committed = false;
  try {
    connection = await db.getConnection();
    const tableName = postType === "donate" ? "ITEM_DONATE" : "ITEM_REQUEST";
    const idColumn = postType === "donate" ? "donate_id" : "request_id";
    const imageTableName =
      postType === "donate" ? "ITEM_DONATE_IMAGE" : "ITEM_REQUEST_IMAGE";

    await connection.beginTransaction();
    transactionStarted = true;

    const [checkRows] = await connection.query(
      `SELECT member_id FROM ${tableName} WHERE ${idColumn} = ? FOR UPDATE`,
      [postId],
    );

    if (checkRows.length === 0) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    }

    if (checkRows[0].member_id !== member_id) {
      return res.status(403).json({ message: "삭제 권한이 없습니다." });
    }

    if (postType === "donate") {
      const [active] = await connection.query(`SELECT pickup_id FROM PICKUP_REQUEST
        WHERE donate_id = ? AND request_status IN ('pending', 'approved') LIMIT 1`, [postId]);
      if (active.length) return res.status(409).json({ message: '진행 중인 나눔 요청을 먼저 취소해주세요.' });
      await deleteIfTableExists(
        connection,
        "DELETE FROM REVIEW WHERE donate_id = ?",
        [postId],
      );
      await deleteIfTableExists(
        connection,
        "DELETE FROM PICKUP_REQUEST WHERE donate_id = ?",
        [postId],
      );
      await deleteIfTableExists(
        connection,
        "DELETE FROM ITEM_DONATE_LIKE WHERE donate_id = ?",
        [postId],
      );
      await deleteIfTableExists(
        connection,
        "DELETE FROM DYNAMIC_QR WHERE donate_id = ?",
        [postId],
      );
    } else {
      await deleteIfTableExists(
        connection,
        "DELETE FROM ITEM_REQUEST_LIKE WHERE request_id = ?",
        [postId],
      );
    }

    await connection.query(
      `DELETE FROM ${imageTableName} WHERE ${idColumn} = ?`,
      [postId],
    );
    await connection.query(`DELETE FROM ITEM WHERE ${idColumn} = ?`, [postId]);
    await connection.query(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`, [
      postId,
    ]);

    await connection.commit();

    committed = true;
    return res.status(200).json({ message: "게시글이 삭제되었습니다." });
  } catch (error) {
    console.error("게시글 삭제 오류:", error);
    return res.status(500).json({ message: "게시글 삭제에 실패했습니다." });
  } finally {
    if (transactionStarted && !committed) {
      await rollbackQuietly(connection);
    }
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  getAllPosts,
  analyzeImage,
  createPost,
  getPostDetail,
  createPickupRequest,
  updatePost,
  deletePost,
};

const express = require("express");
const aixos = require("axios"); // AI 서버와 통신을 위해 불러옴
const FormData = require("form-data"); // 사진 파일을 폼 데이터로 감싸기 위함
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");
const router = express.Router();

// ==========================================
// 1. 게시글 전체 목록 조회 API (GET /api/posts)
// ==========================================
router.get("/", async (req, res) => {
  try {
    // 기부 글과 요청 글을 합쳐서 최신순(created_at DESC)으로 정렬하여 가져옵니다.
    const sql = `
            SELECT donate_id AS post_id, member_id, title, status, created_at, 'donate' AS post_type 
            FROM ITEM_DONATE
            UNION ALL
            SELECT request_id AS post_id, member_id, title, status, created_at, 'request' AS post_type 
            FROM ITEM_REQUEST
            ORDER BY created_at DESC
        `;

    const [rows] = await db.query(sql);
    res.status(200).json(rows);
  } catch (error) {
    console.error("목록 조회 에러:", error);
    res.status(500).json({ message: "목록을 불러오는데 실패했습니다." });
  }
});
// ==========================================
// 2. 사진 유해물품 검사 및 AI 추천 API (POST /api/posts/analyze)
// (프론트에서 multer 등을 통해 'image'라는 키로 파일을 보낸다고 가정)
// ==========================================
router.post("/analyze", authenticateToken, async (req, res) => {
  const imageFile = req.file;

  if (!imageFile) {
    return res.status(400).json({ message: "사진 파일이 필요합니다." });
  }

  try {
    const form = new FormData();
    form.append("file", imageFile.buffer, imageFile.originalname);

    // AI 서버로 검증 요청 (주소는 AI 담당자에게 받아서 교체)
    const aiResponse = await axios.post("http://[AI서버IP]/predict", form, {
      headers: { ...form.getHeaders() },
    });

    const { is_dangerous, message, ai_guess } = aiResponse.data;

    // 1. 유해 물품인 경우 (프론트에서 팝업 띄울 수 있게 에러 반환)
    if (is_dangerous === true) {
      return res.status(400).json({
        message: "위험한 물건은 나눔할 수 없습니다.",
        ai_reason: message,
      });
    }

    // 2. 안전한 물품인 경우 (DB 저장 없이 AI 추천 데이터만 프론트로 토스)
    res.status(200).json({
      message: "안전한 물품입니다.",
      ai_guess: ai_guess, // 예: "umbrella"
      ai_message: message, // 예: "이 물건은 umbrella인 것 같습니다! ..."
    });
  } catch (error) {
    console.error("AI 서버 통신 에러:", error);
    res.status(500).json({ message: "사진 검사 중 오류가 발생했습니다." });
  }
});

// ==========================================
// 3. 게시글(물품) 최종 등록 API (POST /api/posts)
// ==========================================
router.post("/", authenticateToken, async (req, res) => {
  const { title, content, item_name, item_condition, product_id } = req.body;
  const member_id = req.user.member_id || req.user.id;
  const role_id = req.user.role_id;

  // 프론트에서 보낸 사진 파일
  const imageFile = req.file;

  try {
    const isDonate = role_id === "general" || role_id === "USER";

    // 기부(나눔) 게시글인데 사진이 없으면 에러 반환!
    if (isDonate && !imageFile) {
      return res
        .status(400)
        .json({ message: "나눔 게시글에는 사진 첨부가 필수입니다." });
    }

    let postId;
    let postType;
    const imageUrl = imageFile ? imageFile.path : null;

    if (isDonate) {
      postType = "donate";

      const [postResult] = await db.query(
        "INSERT INTO ITEM_DONATE (member_id, title, content, product_id, item_name, item_condition, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          member_id,
          title,
          content,
          product_id,
          item_name,
          item_condition,
          "open",
        ],
      );
      postId = postResult.insertId;

      // 기부 글은 위에서 사진을 필수로 걸러냈으므로 무조건 이미지 저장됨
      await db.query(
        "INSERT INTO ITEM_DONATE_IMAGE (donate_id, image_url) VALUES (?, ?)",
        [postId, imageUrl],
      );
    } else {
      postType = "request";

      const [postResult] = await db.query(
        "INSERT INTO ITEM_REQUEST (member_id, title, content, product_id, item_name, item_condition, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          member_id,
          title,
          content,
          product_id,
          item_name,
          item_condition,
          "open",
        ],
      );
      postId = postResult.insertId;

      // 요청 글은 사진 필수가 아니므로, 사진이 있을 때만 이미지 테이블에 저장
      if (imageUrl) {
        await db.query(
          "INSERT INTO ITEM_REQUEST_IMAGE (request_id, image_url) VALUES (?, ?)",
          [postId, imageUrl],
        );
      }
    }

    res.status(201).json({
      message: "게시글이 성공적으로 등록되었습니다.",
      post_id: postId,
      post_type: postType,
    });
  } catch (error) {
    console.error("게시글 등록 에러:", error);
    res.status(500).json({ message: "게시글 등록에 실패했습니다." });
  }
});

// ==========================================
// 4. 게시글 상세 조회 API (GET /api/posts/:id)
// ==========================================
router.get("/:id", async (req, res) => {
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
        message: "게시글 타입(type=donate 또는 request)을 주소에 포함해주세요.",
      });
    }

    const [rows] = await db.query(sql, [postId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("상세 조회 에러:", error);
    res.status(500).json({ message: "상세 정보를 불러오는데 실패했습니다." });
  }
});

// ==========================================
// 5. 게시글(물품) 수정 API (PUT /api/posts/:id)
// ==========================================
router.put("/:id", authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const postType = req.query.type;

  const { title, content, item_name, item_condition, product_id } = req.body;
  const member_id = req.user.member_id || req.user.id;

  if (!postType || (postType !== "donate" && postType !== "request")) {
    return res
      .status(400)
      .json({ message: "type(donate/request)을 주소에 정확히 입력해주세요." });
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
      return res
        .status(403)
        .json({ message: "내가 작성한 글만 수정할 수 있습니다." });
    }

    await db.query(
      `UPDATE ${tableName} SET title = ?, content = ?, updated_at = NOW() WHERE ${idColumn} = ?`,
      [title, content, postId],
    );

    await db.query(
      `UPDATE ITEM SET product_id = ?, item_name = ?, item_condition = ? WHERE ${idColumn} = ?`,
      [product_id, item_name, item_condition, postId],
    );

    res.status(200).json({ message: "게시글이 성공적으로 수정되었습니다." });
  } catch (error) {
    console.error("게시글 수정 에러:", error);
    res.status(500).json({ message: "게시글 수정에 실패했습니다." });
  }
});

// ==========================================
// 6. 게시글(물품) 삭제 API (DELETE /api/posts/:id)
// ==========================================
router.delete("/:id", authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const postType = req.query.type;
  const member_id = req.user.member_id || req.user.id;

  if (!postType || (postType !== "donate" && postType !== "request")) {
    return res
      .status(400)
      .json({ message: "type(donate/request)을 주소에 정확히 입력해주세요." });
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
      return res
        .status(403)
        .json({ message: "내가 작성한 글만 삭제할 수 있습니다." });
    }

    await db.query(`DELETE FROM ITEM WHERE ${idColumn} = ?`, [postId]);
    await db.query(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`, [postId]);

    res.status(200).json({ message: "게시글이 성공적으로 삭제되었습니다." });
  } catch (error) {
    console.error("게시글 삭제 에러:", error);
    res.status(500).json({ message: "게시글 삭제에 실패했습니다." });
  }
});

module.exports = router;

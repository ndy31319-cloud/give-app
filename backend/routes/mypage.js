const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../middlewares/authMiddleware");

// ==========================================
// 마이페이지 작성 내역 조회 API (GET /api/mypage/histories)
// ==========================================
router.get("/histories", authenticateToken, async (req, res) => {
  // 토큰에서 내 유저 번호 꺼내기
  const member_id = req.user.member_id || req.user.id;

  try {
    // 내가 쓴 기부 글과 요청 글만 합쳐서 최신순으로 가져오기
    const sql = `
            SELECT donate_id AS post_id, title, status, created_at, 'donate' AS post_type 
            FROM ITEM_DONATE
            WHERE member_id = ?
            UNION ALL
            SELECT request_id AS post_id, title, status, created_at, 'request' AS post_type 
            FROM ITEM_REQUEST
            WHERE member_id = ?
            ORDER BY created_at DESC
        `;

    // ?가 두 개니까 member_id도 두 번 넣음.
    const [rows] = await db.query(sql, [member_id, member_id]);
    res.status(200).json(rows);
  } catch (error) {
    console.error("마이페이지 내역 조회 에러:", error);
    res.status(500).json({ message: "내역을 불러오는데 실패했습니다." });
  }
});

module.exports = router;

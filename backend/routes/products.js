const express = require("express");
const db = require("../db");

const router = express.Router();

const toProductResponse = (row) => ({
  productId: String(row.product_id),
  product_id: row.product_id,
  category: row.category,
  productName: row.product_name,
  product_name: row.product_name,
});

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT product_id, category, product_name
       FROM PRODUCT
       ORDER BY category ASC, product_name ASC, product_id ASC`,
    );

    res.json({
      success: true,
      data: rows.map(toProductResponse),
    });
  } catch (error) {
    console.error("List products error:", error);
    res.status(500).json({
      success: false,
      message: "상품 목록을 불러오지 못했습니다.",
    });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT category
       FROM PRODUCT
       WHERE category IS NOT NULL AND category <> ''
       GROUP BY category
       ORDER BY category ASC`,
    );

    res.json({
      success: true,
      data: rows.map((row) => ({
        id: row.category,
        label: row.category,
      })),
    });
  } catch (error) {
    console.error("List product categories error:", error);
    res.status(500).json({
      success: false,
      message: "카테고리 목록을 불러오지 못했습니다.",
    });
  }
});

module.exports = router;

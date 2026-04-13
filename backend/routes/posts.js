const express = require("express");
const authenticateToken = require("../middlewares/authMiddleware");
const upload = require("../uploads/upload");
const postController = require("../controllers/postController");

const router = express.Router();

router.get("/", postController.getAllPosts);
router.post(
  "/analyze",
  authenticateToken,
  upload.fields([
    { name: "image", maxCount: 10 },
    { name: "images", maxCount: 10 },
  ]),
  postController.analyzeImage,
);
router.post(
  "/",
  authenticateToken,
  upload.fields([
    { name: "image", maxCount: 10 },
    { name: "images", maxCount: 10 },
  ]),
  postController.createPost,
);
router.get("/:id", postController.getPostDetail);
router.put("/:id", authenticateToken, postController.updatePost);
router.delete("/:id", authenticateToken, postController.deletePost);

module.exports = router;

const express = require("express");

const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Public - anyone can view categories
router.get("/", getCategories);

// Admin only - create category
router.post(
  "/",
  protect,
  authorizeRoles("admin"),
  createCategory
);

// Admin only - update category
router.put(
  "/:id",
  protect,
  authorizeRoles("admin"),
  updateCategory
);

// Admin only - deactivate category
router.delete(
  "/:id",
  protect,
  authorizeRoles("admin"),
  deleteCategory
);

module.exports = router;
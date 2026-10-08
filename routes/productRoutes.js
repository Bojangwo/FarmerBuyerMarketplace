const express = require("express");
const upload = require("../middleware/uploadMiddleware");

const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Public - anyone can browse products
router.get("/", getProducts);

// Public - anyone can view one product
router.get("/:id", getProductById);

// Farmer only - create product
router.post(
  "/",
  protect,
  authorizeRoles("farmer"),
  upload.array("images", 5),
  createProduct
);

// Farmer only - update own product
router.put(
  "/:id",
  protect,
  authorizeRoles("farmer"),
  updateProduct
);

// Farmer only - remove own product
router.delete(
  "/:id",
  protect,
  authorizeRoles("farmer"),
  deleteProduct
);

module.exports = router;
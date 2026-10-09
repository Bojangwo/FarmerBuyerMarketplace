
const express = require("express");

const {
  getMyOrders,
  getOrderById,
  updateOrderStatus,
} = require("../controllers/orderController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// View the logged-in user's orders
router.get("/", protect, getMyOrders);

router.patch(
  "/:orderId/status",
  protect,
  require("../middleware/roleMiddleware")("farmer"),
  updateOrderStatus
);

// View one order's details
router.get("/:orderId", protect, getOrderById);

module.exports = router;

const express = require("express");

const {
  getMyOrders,
  getMyDeliveries,
  getOrderById,
  updateOrderStatus,
  assignDeliveryAgent,
  updateDeliveryStatus,
  getDeliveryHistory,
} = require("../controllers/orderController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// View the logged-in user's orders
router.get("/", protect, getMyOrders);

router.get(
  "/my-deliveries",
  protect,
  require("../middleware/roleMiddleware")("deliveryAgent"),
  getMyDeliveries
);

router.patch(
  "/:orderId/delivery-status",
  protect,
  require("../middleware/roleMiddleware")("deliveryAgent"),
  updateDeliveryStatus
);

router.patch(
  "/:orderId/status",
  protect,
  require("../middleware/roleMiddleware")("farmer"),
  updateOrderStatus
);

router.patch(
  "/:orderId/assign-delivery",
  protect,
  require("../middleware/roleMiddleware")("admin"),
  assignDeliveryAgent
);

// Admin views an order's delivery assignment history
router.get(
  "/:orderId/delivery-history",
  protect,
  require("../middleware/roleMiddleware")("admin"),
  getDeliveryHistory
);

// View one order's details
router.get("/:orderId", protect, getOrderById);



module.exports = router;

const express = require("express");

const {
  getMyOrders,
  getMyDeliveries,
  getOrderById,
  updateOrderStatus,
  assignDeliveryAgent,
  updateDeliveryStatus,
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


// View one order's details
router.get("/:orderId", protect, getOrderById);



module.exports = router;
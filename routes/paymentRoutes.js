const express = require("express");

const {
  initiatePayment,
  verifyPayment
} = require("../controllers/paymentController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Only authenticated buyers can initiate payments
router.post(
  "/:orderId/initiate",
  protect,
  authorizeRoles("buyer"),
  initiatePayment
);

// Only authenticated buyers can verify their payments
router.get(
  "/:paymentId/verify",
  protect,
  authorizeRoles("buyer"),
  verifyPayment
);

module.exports = router;
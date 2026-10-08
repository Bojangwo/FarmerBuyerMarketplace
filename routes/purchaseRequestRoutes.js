
const express = require("express");

const {
  createPurchaseRequest,
  getFarmerPurchaseRequests,
  respondToPurchaseRequest,
} = require("../controllers/purchaseRequestController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Buyers can create purchase requests
router.post(
  "/",
  protect,
  authorizeRoles("buyer"),
  createPurchaseRequest
);

// Farmers can view requests sent to them
router.get(
  "/farmer",
  protect,
  authorizeRoles("farmer"),
  getFarmerPurchaseRequests
);

router.patch(
  "/:requestId/respond",
  protect,
  authorizeRoles("farmer"),
  respondToPurchaseRequest
);

module.exports = router;
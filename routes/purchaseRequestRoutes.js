const express = require("express");

const {
  createPurchaseRequest,
} = require("../controllers/purchaseRequestController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.post(
  "/",
  protect,
  authorizeRoles("buyer"),
  createPurchaseRequest
);

module.exports = router;
const express = require("express");

const {
  createDeliveryAgent,
  getDeliveryAgents,
  updateDeliveryAgentStatus,
} = require("../controllers/deliveryAgentController");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Admin can create a delivery agent
router.post(
  "/",
  protect,
  authorizeRoles("admin"),
  createDeliveryAgent
);

// Admin can view all delivery agents
router.get(
  "/",
  protect,
  authorizeRoles("admin"),
  getDeliveryAgents
);

// Admin can update a delivery agent's status
router.patch(
  "/:agentId/status",
  protect,
  authorizeRoles("admin"),
  updateDeliveryAgentStatus
);

module.exports = router;
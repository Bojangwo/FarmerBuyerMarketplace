const express = require("express");

const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
  "/farmer-only",
  protect,
  authorizeRoles("farmer"),
  (req, res) => {
    res.json({
      message: "You successfully accessed a farmer-only route.",
      user: req.user,
    });
  }
);

module.exports = router;
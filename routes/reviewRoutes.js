
const express = require("express");
const router = express.Router();

const {
  createReview,
  getFarmerReviews,
} = require("../controllers/reviewController");

// Use the same authentication middleware as the existing routes
const protect = require("../middleware/authMiddleware");

// Buyer submits a review
router.post("/", protect, createReview);

// View reviews for a farmer
router.get("/farmer/:farmerId", getFarmerReviews);

module.exports = router;

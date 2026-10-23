
const mongoose = require("mongoose");
const Review = require("../models/Review");
const Order = require("../models/Order");

// Create a review for a completed purchase
const createReview = async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID",
      });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Rating must be a whole number between 1 and 5",
      });
    }

    if (
      comment !== undefined &&
      (typeof comment !== "string" || comment.length > 1000)
    ) {
      return res.status(400).json({
        message: "Comment must be a string of at most 1000 characters",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Only the buyer who placed the order can review it
    if (String(order.buyer) !== String(req.user.id)) {
      return res.status(403).json({
        message: "You cannot review this order",
      });
    }

    // Reviews are only allowed after successful completion
    if (order.status !== "completed" || order.paymentStatus !== "paid") {
      return res.status(400).json({
        message: "Only completed and paid orders can be reviewed",
      });
    }

    const existingReview = await Review.findOne({
      order: order._id,
    });

    if (existingReview) {
      return res.status(409).json({
        message: "This order has already been reviewed",
      });
    }

    const review = await Review.create({
      order: order._id,
      buyer: order.buyer,
      farmer: order.farmer,
      product: order.product,
      rating,
      comment: comment || "",
    });

    return res.status(201).json({
      message: "Review submitted successfully",
      review,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This order has already been reviewed",
      });
    }

    console.error("Create review error:", error);

    return res.status(500).json({
      message: "Server error while creating review",
    });
  }
};

// Get reviews for a farmer
const getFarmerReviews = async (req, res) => {
  try {
    const { farmerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(farmerId)) {
      return res.status(400).json({
        message: "Invalid farmer ID",
      });
    }

    const reviews = await Review.find({ farmer: farmerId })
      .populate("buyer", "name")
      .populate("product", "name")
      .sort({ createdAt: -1 });

    const averageRating = reviews.length
      ? Number(
          (
            reviews.reduce((sum, review) => sum + review.rating, 0) /
            reviews.length
          ).toFixed(1)
        )
      : 0;

    return res.status(200).json({
      farmerId,
      totalReviews: reviews.length,
      averageRating,
      reviews,
    });
  } catch (error) {
    console.error("Get farmer reviews error:", error);

    return res.status(500).json({
      message: "Server error while fetching farmer reviews",
    });
  }
};

module.exports = {
  createReview,
  getFarmerReviews,
};

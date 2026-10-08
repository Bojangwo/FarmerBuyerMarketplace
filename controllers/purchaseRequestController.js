const mongoose = require("mongoose");

const PurchaseRequest = require("../models/PurchaseRequest");
const Product = require("../models/Product");
const User = require("../models/User");

const createPurchaseRequest = async (req, res) => {
  try {
    const { product, quantityRequested, message } = req.body;

    if (!product || quantityRequested === undefined) {
      return res.status(400).json({
        message: "Product and requested quantity are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(product)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const quantity = Number(quantityRequested);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "Requested quantity must be greater than 0",
      });
    }

    const existingProduct = await Product.findById(product);

    if (!existingProduct) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    if (existingProduct.status !== "available") {
      return res.status(400).json({
        message: "This product is not currently available",
      });
    }

    if (quantity > existingProduct.quantity) {
      return res.status(400).json({
        message: "Requested quantity exceeds available quantity",
      });
    }

    // A farmer cannot request their own product
    if (existingProduct.farmer.toString() === req.user.id) {
      return res.status(400).json({
        message: "You cannot request your own product",
      });
    }

    const buyer = await User.findById(req.user.id);

    if (!buyer) {
      return res.status(404).json({
        message: "Buyer account not found",
      });
    }

    const purchaseRequest = await PurchaseRequest.create({
      buyer: req.user.id,
      farmer: existingProduct.farmer,
      product: existingProduct._id,
      quantityRequested: quantity,
      message: message ? message.trim() : "",
    });

    const populatedRequest = await PurchaseRequest.findById(
      purchaseRequest._id
    )
      .populate("buyer", "name phone")
      .populate("farmer", "name phone")
      .populate("product", "name price quantity unit images");

    res.status(201).json({
      message: "Purchase request sent successfully",
      purchaseRequest: populatedRequest,
    });
  } catch (error) {
    console.error(
      "Create purchase request error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  createPurchaseRequest,
};
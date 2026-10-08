const mongoose = require("mongoose");

const PurchaseRequest = require("../models/PurchaseRequest");
const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");

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


const getFarmerPurchaseRequests = async (req, res) => {
  try {
    const requests = await PurchaseRequest.find({
      farmer: req.user.id,
    })
      .populate("buyer", "name phone")
      .populate("product", "name price quantity unit images")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("Get farmer purchase requests error:", error);

    return res.status(500).json({
      message: "Server error while fetching purchase requests",
    });
  }
};


const respondToPurchaseRequest = async (req, res) => {
  const { status } = req.body;
  const { requestId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return res.status(400).json({
      message: "Invalid purchase request ID",
    });
  }

  if (!["accepted", "rejected"].includes(status)) {
    return res.status(400).json({
      message: "Status must be accepted or rejected",
    });
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const purchaseRequest = await PurchaseRequest.findOne({
        _id: requestId,
        farmer: req.user.id,
        status: "pending",
      }).session(session);

      if (!purchaseRequest) {
        const error = new Error(
          "Pending purchase request not found or you do not have permission to respond to it"
        );
        error.statusCode = 404;
        throw error;
      }

      // Rejection does not create an order or change stock.
      if (status === "rejected") {
        const updatedRequest =
          await PurchaseRequest.findOneAndUpdate(
            {
              _id: requestId,
              farmer: req.user.id,
              status: "pending",
            },
            { $set: { status: "rejected" } },
            { new: true, session }
          );

        if (!updatedRequest) {
          const error = new Error(
            "This request has already been handled"
          );
          error.statusCode = 409;
          throw error;
        }

        result = {
          message: "Purchase request rejected successfully",
          request: updatedRequest,
        };

        return;
      }

      // Acceptance: load the product.
      const product = await Product.findById(
        purchaseRequest.product
      ).session(session);

      if (!product) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
      }

      const requestedQuantity =
        purchaseRequest.quantityRequested;

      if (
        product.status !== "available" ||
        product.quantity < requestedQuantity
      ) {
        const error = new Error(
          "Product is unavailable or has insufficient stock"
        );
        error.statusCode = 400;
        throw error;
      }

      // Reduce stock only if enough quantity remains.
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: product._id,
          status: "available",
          quantity: { $gte: requestedQuantity },
        },
        {
          $inc: { quantity: -requestedQuantity },
        },
        {
          new: true,
          session,
        }
      );

      if (!updatedProduct) {
        const error = new Error(
          "Insufficient stock. Please check the available quantity."
        );
        error.statusCode = 400;
        throw error;
      }

      // Mark the product out of stock when its quantity reaches zero.
      if (updatedProduct.quantity === 0) {
        await Product.updateOne(
          { _id: updatedProduct._id },
          { $set: { status: "out_of_stock" } },
          { session }
        );
      }

      // Calculate the order using the server-side product price.
      const unitPrice = product.price;
      const subtotal = Number(
        (requestedQuantity * unitPrice).toFixed(2)
      );
      const deliveryFee = 0;
      const totalAmount = Number(
        (subtotal + deliveryFee).toFixed(2)
      );

      // Create exactly one order for this purchase request.
      const [order] = await Order.create(
        [
          {
            orderNumber: `ORD-${new mongoose.Types.ObjectId()
              .toString()
              .toUpperCase()}`,
            buyer: purchaseRequest.buyer,
            farmer: purchaseRequest.farmer,
            product: purchaseRequest.product,
            purchaseRequest: purchaseRequest._id,
            quantity: requestedQuantity,
            unitPrice,
            subtotal,
            deliveryFee,
            totalAmount,
            currency: "GMD",
            status: "pending",
            paymentStatus: "unpaid",
            deliveryStatus: "not_assigned",
          },
        ],
        { session }
      );

      // Change the request to accepted only within the transaction.
      const updatedRequest =
        await PurchaseRequest.findOneAndUpdate(
          {
            _id: requestId,
            farmer: req.user.id,
            status: "pending",
          },
          { $set: { status: "accepted" } },
          { new: true, session }
        );

      if (!updatedRequest) {
        const error = new Error(
          "This request has already been handled"
        );
        error.statusCode = 409;
        throw error;
      }

      result = {
        message: "Purchase request accepted and order created successfully",
        request: updatedRequest,
        order,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Respond to purchase request error:", error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: "An order already exists for this purchase request",
      });
    }

    return res.status(500).json({
      message: "Server error while responding to purchase request",
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createPurchaseRequest,
  getFarmerPurchaseRequests,
  respondToPurchaseRequest,
}; 

const bcrypt = require("bcryptjs");
const User = require("../models/User");

const createDeliveryAgent = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: "Name, email, phone, and password are required.",
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        message: "Password must be at least 12 characters long.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const agent = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password: hashedPassword,
      role: "deliveryAgent",
      location: {
        type: "Point",
        coordinates: [0, 0],
        address: "",
        city: "",
        region: "",
      },
      isVerified: true,
      status: "active",
    });

    return res.status(201).json({
      message: "Delivery agent created successfully.",
      deliveryAgent: {
        id: agent._id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        role: agent.role,
        status: agent.status,
      },
    });
  } catch (error) {
    console.error("Create delivery agent error:", error.message);

    return res.status(500).json({
      message: "Failed to create delivery agent.",
    });
  }
};

const getDeliveryAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: "deliveryAgent" })
      .select("name email phone status isVerified createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      count: agents.length,
      deliveryAgents: agents,
    });
  } catch (error) {
    console.error("Get delivery agents error:", error.message);

    return res.status(500).json({
      message: "Failed to retrieve delivery agents.",
    });
  }
};



const mongoose = require("mongoose");

const updateDeliveryAgentStatus = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(agentId)) {
      return res.status(400).json({
        message: "Invalid delivery agent ID.",
      });
    }

    if (!["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({
        message: "Status must be active or inactive.",
      });
    }

    const agent = await User.findOne({
      _id: agentId,
      role: "deliveryAgent",
    });

    if (!agent) {
      return res.status(404).json({
        message: "Delivery agent not found.",
      });
    }

    agent.status = status;
    await agent.save();

    return res.status(200).json({
      message: `Delivery agent ${status} successfully.`,
      deliveryAgent: {
        id: agent._id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        role: agent.role,
        status: agent.status,
      },
    });
  } catch (error) {
    console.error("Update delivery agent status error:", error.message);

    return res.status(500).json({
      message: "Failed to update delivery agent status.",
    });
  }
};


module.exports = {
  createDeliveryAgent,
  getDeliveryAgents,
  updateDeliveryAgentStatus,
};


const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("./models/User");

dotenv.config();

const createDeliveryAgent = async () => {
  try {
    const {
      DELIVERY_AGENT_NAME,
      DELIVERY_AGENT_EMAIL,
      DELIVERY_AGENT_PHONE,
      DELIVERY_AGENT_PASSWORD,
    } = process.env;

    if (
      !DELIVERY_AGENT_NAME ||
      !DELIVERY_AGENT_EMAIL ||
      !DELIVERY_AGENT_PHONE ||
      !DELIVERY_AGENT_PASSWORD
    ) {
      throw new Error(
        "Please set all DELIVERY_AGENT variables in your .env file."
      );
    }

    if (DELIVERY_AGENT_PASSWORD.length < 12) {
      throw new Error("Use a password with at least 12 characters.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const email = DELIVERY_AGENT_EMAIL.trim().toLowerCase();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.role === "deliveryAgent") {
        console.log("This delivery-agent account already exists.");
        return;
      }

      throw new Error(
        "This email belongs to another account. Use a different email."
      );
    }

    const hashedPassword = await bcrypt.hash(
      DELIVERY_AGENT_PASSWORD,
      10
    );

    const agent = await User.create({
      name: DELIVERY_AGENT_NAME.trim(),
      email,
      phone: DELIVERY_AGENT_PHONE.trim(),
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

    console.log("Delivery-agent account created successfully.");
    console.log("Email:", agent.email);
    console.log("Role:", agent.role);
  } catch (error) {
    console.error("Error creating delivery agent:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

createDeliveryAgent();

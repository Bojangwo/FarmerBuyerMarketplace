const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("./models/User");

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    const existingAdmin = await User.findOne({
      role: "admin",
    });

    if (existingAdmin) {
      console.log("An admin account already exists.");
      process.exit(0);
    }

    const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  throw new Error("ADMIN_PASSWORD is missing from .env");
}

const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const admin = await User.create({
      name: "System Administrator",
      email: "admin@farmermarket.gm",
      phone: "0000000",
      password: hashedPassword,
      role: "admin",

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

    console.log("Admin account created successfully.");
    console.log("Email:", admin.email);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error creating admin:", error.message);

    await mongoose.connection.close();
    process.exit(1);
  }
};

createAdmin();
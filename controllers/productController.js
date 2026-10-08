const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const isValidCoordinates = (coordinates) => {
  return (
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every((value) => typeof value === "number" && Number.isFinite(value)) &&
    coordinates[0] >= -180 &&
    coordinates[0] <= 180 &&
    coordinates[1] >= -90 &&
    coordinates[1] <= 90
  );
};

const validProductStatuses = [
  "available",
  "out_of_stock",
  "sold",
  "inactive",
]; 

// Get all available products
const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      region,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 10,
      latitude,
      longitude,
      radius,
    } = req.query;

    const filter = {
      status: "available",
    };

    let nearQuery = null;

if (
  latitude !== undefined ||
  longitude !== undefined ||
  radius !== undefined
) {
  if (
    latitude === undefined ||
    longitude === undefined ||
    radius === undefined
  ) {
    return res.status(400).json({
      message:
        "Latitude, longitude, and radius are all required for nearby search",
    });
  }

  const userLatitude = Number(latitude);
  const userLongitude = Number(longitude);
  const searchRadius = Number(radius);

  if (!Number.isFinite(userLatitude) || userLatitude < -90 || userLatitude > 90) {
    return res.status(400).json({
      message: "Invalid latitude",
    });
  }

  if (
    !Number.isFinite(userLongitude) ||
    userLongitude < -180 ||
    userLongitude > 180
  ) {
    return res.status(400).json({
      message: "Invalid longitude",
    });
  }

  if (!Number.isFinite(searchRadius) || searchRadius <= 0) {
    return res.status(400).json({
      message: "Radius must be greater than 0",
    });
  }

  nearQuery = {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [userLongitude, userLatitude],
      },
      $maxDistance: searchRadius * 1000,
    },
  };
}

    // Search by product name
    if (search && search.trim()) {
      filter.name = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    // Filter by category
    if (category) {
      if (!isValidObjectId(category)) {
        return res.status(400).json({
          message: "Invalid category ID",
        });
      }

      filter.category = category;
    }

    // Filter by region
    if (region && region.trim()) {
      filter["location.region"] = {
        $regex: region.trim(),
        $options: "i",
      };
    }

    // Price filtering
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};

      if (minPrice !== undefined) {
        const minimumPrice = Number(minPrice);

        if (!Number.isFinite(minimumPrice) || minimumPrice < 0) {
          return res.status(400).json({
            message: "Invalid minimum price",
          });
        }

        filter.price.$gte = minimumPrice;
      }

      if (maxPrice !== undefined) {
        const maximumPrice = Number(maxPrice);

        if (!Number.isFinite(maximumPrice) || maximumPrice < 0) {
          return res.status(400).json({
            message: "Invalid maximum price",
          });
        }

        filter.price.$lte = maximumPrice;
      }

      if (
        filter.price.$gte !== undefined &&
        filter.price.$lte !== undefined &&
        filter.price.$gte > filter.price.$lte
      ) {
        return res.status(400).json({
          message: "Minimum price cannot be greater than maximum price",
        });
      }
    }

    // Sorting
    let sortOption = { createdAt: -1 };

    if (sort === "price_asc") {
      sortOption = { price: 1 };
    } else if (sort === "price_desc") {
      sortOption = { price: -1 };
    } else if (sort === "newest") {
      sortOption = { createdAt: -1 };
    } else if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    } else if (sort) {
      return res.status(400).json({
        message: "Invalid sort option",
      });
    }

    // Pagination
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1
    ) {
      return res.status(400).json({
        message: "Page must be a positive integer",
      });
    }

    if (
      !Number.isInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > 50
    ) {
      return res.status(400).json({
        message: "Limit must be between 1 and 50",
      });
    }

    const skip = (pageNumber - 1) * limitNumber;

    const totalProducts = await Product.countDocuments(filter);

    if (nearQuery) {
  filter.location = nearQuery;
}

    const products = await Product.find(filter)
      .populate("farmer", "name phone location")
      .populate("category", "name")
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);

    const totalPages = Math.ceil(totalProducts / limitNumber);

    res.status(200).json({
      count: products.length,
      totalProducts,
      totalPages,
      currentPage: pageNumber,
      products,
    });
  } catch (error) {
    console.error("Get products error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Get a single product
const getProductById = async (req, res) => {
  try {
    
    const { id } = req.params;

if (!isValidObjectId(id)) {
  return res.status(400).json({
    message: "Invalid product ID",
  });
}

const product = await Product.findById(id)


      .populate("farmer", "name phone location")
      .populate("category", "name");

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.status(200).json({
      product,
    });
  } catch (error) {
    console.error("Get product error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Create product
const createProduct = async (req, res) => {
  try {
    const {
  category,
  name,
  description,
  price,
  quantity,
  unit,
  location,
} = req.body;
let parsedLocation;

try {
  parsedLocation = JSON.parse(location);
} catch (error) {
  return res.status(400).json({
    message: "Location must be valid JSON",
  });
}

    if (
  !category ||
  !name ||
  !description ||
  price === undefined ||
  quantity === undefined ||
  !unit ||
  !parsedLocation ||
  !parsedLocation.coordinates
) {
  return res.status(400).json({
    message: "Please provide all required product information",
  });
}

if (!isValidObjectId(category)) {
  return res.status(400).json({
    message: "Invalid category ID",
  });
}

if (!name.trim() || !description.trim() || !unit.trim()) {
  return res.status(400).json({
    message: "Name, description, and unit cannot be empty",
  });
}

const productPrice = Number(price);
const productQuantity = Number(quantity);

if (!Number.isFinite(productPrice) || productPrice < 0) {
  return res.status(400).json({
    message: "Price must be a valid number greater than or equal to 0",
  });
}

if (!Number.isFinite(productQuantity) || productQuantity < 0) {
  return res.status(400).json({
    message: "Quantity must be a valid number greater than or equal to 0",
  });
}

if (!isValidCoordinates(parsedLocation.coordinates)) {
  return res.status(400).json({
    message:
      "Location coordinates must contain valid longitude and latitude values",
  });
}

    // Check category
    const categoryExists = await Category.findOne({
      _id: category,
      status: "active",
    });

    if (!categoryExists) {
      return res.status(400).json({
        message: "Invalid or inactive category",
      });
    }

    // Validate price
    if (Number(price) < 0) {
      return res.status(400).json({
        message: "Price cannot be negative",
      });
    }

    // Validate quantity
    if (Number(quantity) < 0) {
      return res.status(400).json({
        message: "Quantity cannot be negative",
      });
    }

    const imagePaths = req.files
  ? req.files.map((file) => `/uploads/${file.filename}`)
  : [];
    const product = await Product.create({
      farmer: req.user.id,
      category,
      name: name.trim(),
      description: description.trim(),
      images: imagePaths,
      price: productPrice,
      quantity: productQuantity,
      unit: unit.trim(),

      location: {
        type: "Point",
        coordinates: parsedLocation.coordinates,
        address: parsedLocation.address || "",
        city: parsedLocation.city || "",
        region: parsedLocation.region || "",
      },
    });

    const populatedProduct = await Product.findById(product._id)
      .populate("farmer", "name phone location")
      .populate("category", "name");

    res.status(201).json({
      message: "Product created successfully",
      product: populatedProduct,
    });
  } catch (error) {
    console.error("Create product error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
  return res.status(400).json({
    message: "Invalid product ID",
  });
}

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Check ownership
    if (product.farmer.toString() !== req.user.id) {
      return res.status(403).json({
        message: "You can only update your own products",
      });
    }

    const {
      category,
      name,
      description,
      images,
      price,
      quantity,
      unit,
      location,
      status,
    } = req.body;

    // Validate category if changed
    if (category) {
      const categoryExists = await Category.findOne({
        _id: category,
        status: "active",
      });

      if (!categoryExists) {
        return res.status(400).json({
          message: "Invalid or inactive category",
        });
      }

      product.category = category;
    }

    if (name !== undefined) {
      product.name = name.trim();
    }

    if (description !== undefined) {
      product.description = description.trim();
    }

    if (images !== undefined) {
      product.images = images;
    }

    if (price !== undefined) {
  const updatedPrice = Number(price);

  if (!Number.isFinite(updatedPrice) || updatedPrice < 0) {
    return res.status(400).json({
      message: "Price must be a valid number greater than or equal to 0",
    });
  }

  product.price = updatedPrice;
}

    if (quantity !== undefined) {
  const updatedQuantity = Number(quantity);

  if (!Number.isFinite(updatedQuantity) || updatedQuantity < 0) {
    return res.status(400).json({
      message: "Quantity must be a valid number greater than or equal to 0",
    });
  }

  product.quantity = updatedQuantity;
}

    if (unit !== undefined) {
      product.unit = unit.trim();
    }

    if (location !== undefined) {
  if (!parsedLocation.coordinates) {
    return res.status(400).json({
      message: "Location coordinates are required",
    });
  }

  if (!isValidCoordinates(parsedLocation.coordinates)) {
    return res.status(400).json({
      message:
        "Location coordinates must contain valid longitude and latitude values",
    });
  }

  product.location = {
    type: "Point",
    coordinates: parsedLocation.coordinates,
    address: parsedLocation.address || "",
    city: parsedLocation.city || "",
    region: parsedLocation.region || "",
  };
}

    if (status !== undefined) {
  if (!validProductStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid product status",
    });
  }

  product.status = status;
}

    await product.save();

    const updatedProduct = await Product.findById(product._id)
      .populate("farmer", "name phone location")
      .populate("category", "name");

    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update product error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Deactivate product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Check ownership
    if (product.farmer.toString() !== req.user.id) {
      return res.status(403).json({
        message: "You can only remove your own products",
      });
    }

    product.status = "inactive";

    await product.save();

    res.status(200).json({
      message: "Product removed successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
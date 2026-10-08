const Category = require("../models/Category");

// Get all active categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      status: "active",
    }).sort({ name: 1 });

    res.status(200).json({
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Create category
const createCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Category name is required",
      });
    }

    const existingCategory = await Category.findOne({
      name: name.trim(),
    });

    if (existingCategory) {
      return res.status(400).json({
        message: "A category with this name already exists",
      });
    }

    const category = await Category.create({
      name: name.trim(),
      description: description || "",
      image: image || "",
    });

    res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("Create category error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, status } = req.body;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    if (name) {
      const duplicateCategory = await Category.findOne({
        name: name.trim(),
        _id: { $ne: id },
      });

      if (duplicateCategory) {
        return res.status(400).json({
          message: "A category with this name already exists",
        });
      }

      category.name = name.trim();
    }

    if (description !== undefined) {
      category.description = description;
    }

    if (image !== undefined) {
      category.image = image;
    }

    if (status !== undefined) {
      category.status = status;
    }

    await category.save();

    res.status(200).json({
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("Update category error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Deactivate category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    category.status = "inactive";

    await category.save();

    res.status(200).json({
      message: "Category deactivated successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
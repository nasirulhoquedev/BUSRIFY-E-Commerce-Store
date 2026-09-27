const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      unique: true,
      trim: true,
      index: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      index: true,
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0
    },
    original_price: {
      type: Number,
      default: null
    },
    rating: {
      type: Number,
      default: 4.5,
      min: 0,
      max: 5
    },
    reviews_count: {
      type: Number,
      default: 0,
      min: 0
    },
    stock: {
      type: Number,
      default: 15,
      min: 0
    },
    description: {
      type: String,
      required: [true, 'Description is required']
    },
    features: {
      type: [String],
      default: []
    },
    image_url: {
      type: String,
      required: [true, 'Image URL is required']
    },
    badge: {
      type: String,
      default: null
    },
    is_featured: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Add text search index for search functionality
productSchema.index({ name: 'text', description: 'text', category: 'text' });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

module.exports = Product;

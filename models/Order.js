const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    product_name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    image_url: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    order_number: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    user_id: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true
    },
    customer_name: {
      type: String,
      required: true,
      trim: true
    },
    customer_email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    shipping_address: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    items: {
      type: [orderItemSchema],
      required: true,
      default: []
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    shipping_fee: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    total_amount: {
      type: Number,
      required: true,
      min: 0
    },
    payment_method: {
      type: String,
      default: 'Credit Card'
    },
    status: {
      type: String,
      enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Processing'
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

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

module.exports = Order;

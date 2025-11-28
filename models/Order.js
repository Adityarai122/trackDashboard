import mongoose from 'mongoose';

/**
 * Order Schema
 * Represents a dispatched order in the system.
 * This collection stores all historical order data that has been processed and dispatched.
 */
const OrderSchema = new mongoose.Schema(
  {
    // Order Identification
    poNumber: { type: String, default: "", index: true },  // Purchase Order Number
    soNumber: { type: String, default: "", index: true },   // Sales Order Number
    orderNumber: { type: String, default: "" },             // Internal Order Number
    
    // Product Details
    productCode: { type: String, default: "", index: true }, // Product identifier
    partNumber: { type: String, default: "" },               // Part number/SKU
    size: { type: String, default: "" },                    // Product size/variant
    drawingNumber: { type: String, default: "" },           // Technical drawing reference
    
    // Customer Information
    customerName: { type: String, default: "", index: true }, // Name of the customer
    customerCode: { type: String, default: "" },             // Internal customer code

    // Line Item Information
    lineItemNumber: { 
      type: String, 
      default: "",
      index: true 
    },

    // Quantity Information
    quantity: { type: Number, default: 0 },          // Original ordered quantity
    dispatchQuantity: { type: Number, default: 0 },  // Quantity dispatched
    pendingQuantity: { type: Number, default: 0 },   // Quantity remaining (for reference)

    // Financial Information
    grossWeight: { type: Number, default: 0 },      // Actual weight of goods
    chargeWeight: { type: Number, default: 0 },     // Weight used for billing
    rate: { type: Number, default: 0 },             // Price per unit

    // Date Fields
    soDate: { type: String, default: "" },          // Sales Order date
    orderDate: { type: String, default: "" },       // Order placement date
    dispatchDate: { 
      type: String, 
      default: "",
      index: true 
    },                                              // Date of dispatch
    expectedDeliveryDate: { 
      type: String, 
      default: "",
      index: true 
    },                                              // Expected delivery date
    packSlipDate: { type: String, default: "" },    // Packing slip generation date

    // Shipping Information
    invoiceDate: { type: String, default: "" },     // Invoice generation date
    invoiceNumber: { 
      type: String, 
      default: "",
      index: true 
    },                                              // Invoice number
    truckNumber: { type: String, default: "" },     // Vehicle number
    transport: { type: String, default: "" },       // Transport company name

    // Additional Information
    departmentRemark: { type: String, default: "" }, // Internal notes
    soSpecialRemark: { type: String, default: "" },  // Special instructions
    dieIndent: { type: String, default: "" },       // Die reference

    // System Fields
    source: { type: String, default: "" },          // Data source/import reference
    raw: { type: Object, default: {} },             // Original unprocessed data
  },
  { 
    timestamps: true, // Adds createdAt and updatedAt fields
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for frequently queried fields
OrderSchema.index({ poNumber: 1, productCode: 1, size: 1 });
OrderSchema.index({ customerName: 1, orderDate: -1 });
OrderSchema.index({ dispatchDate: -1 });

/**
 * Pre-save hook to ensure data consistency
 */
OrderSchema.pre('save', function(next) {
  // Ensure numeric fields are properly cast to numbers
  this.quantity = Number(this.quantity) || 0;
  this.dispatchQuantity = Number(this.dispatchQuantity) || 0;
  this.pendingQuantity = Number(this.pendingQuantity) || 0;
  this.grossWeight = Number(this.grossWeight) || 0;
  this.chargeWeight = Number(this.chargeWeight) || 0;
  this.rate = Number(this.rate) || 0;
  
  next();
});

/**
 * Static method to find orders by customer name
 * @param {string} customerName - Name of the customer to search for
 * @returns {Promise<Array>} - Array of matching orders
 */
OrderSchema.statics.findByCustomer = async function(customerName) {
  return this.find({ customerName: new RegExp(customerName, 'i') });
};

// Create and export the Order model
export default mongoose.model("Order", OrderSchema);
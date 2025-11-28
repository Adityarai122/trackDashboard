/**
 * Maps raw row data from different file formats to a standardized order object.
 * Handles various field name variations from different data sources.
 * 
 * @param {Object} row - Raw row data from the source file
 * @returns {Object} Standardized order object with cleaned and typed fields
 */
const mapFields = (row) => {
  return {
    // Order Identification
    poNumber: row["Order No"] || row["PO No"] || "",          // Purchase Order Number
    soNumber: row["S/O No"] || row["SO No"] || "",            // Sales Order Number
    orderNumber: row["Order No"] || "",                       // Internal Order Number
    
    // Product Information
    productCode: row["Item Code"] || row["Produce Code"] || "", // Product identifier
    partNumber: row["Style No"] || "",                        // Part/Style number
    size: row["Size"] || "",                                  // Product size/variant
    drawingNumber: row["Drg.No"] || "",                       // Technical drawing reference
    
    // Customer Information
    customerName: row["Buyer Name"] || row["Party Name"] || "", // Customer/company name
    customerCode: row["Cust Code"] || "",                     // Internal customer code

    /**
     * Line Item / Serial Number to distinguish between duplicate PO + Product combinations
     * This ensures each line item is uniquely identified even with the same PO and product
     */
    lineItemNumber: row["PO Srl"] || row["P Srl"] || row["Line"] || "",

    // Quantity Information
    quantity: Number(row["Order Qty"]) || 0,                  // Total ordered quantity
    dispatchQuantity: Number(row["Sale Qty"]) || 0,           // Quantity dispatched
    pendingQuantity: Number(row["O/S Ord.Qty"]) || 0,         // Outstanding quantity

    // Financial Information
    grossWeight: Number(row["Gross Wt"]) || 0,                // Total weight of goods
    chargeWeight: Number(row["Chg.Wt"]) || 0,                 // Weight used for billing
    rate: Number(row["Rate"]) || 0,                           // Price per unit

    // Date Fields
    soDate: row["S/O Date"] || "",                            // Sales Order date
    orderDate: row["Order Date"] || "",                       // Order placement date
    dispatchDate: row["Dispatch Date"] || "",                 // Date of dispatch
    expectedDeliveryDate: row["Delivery Date"] || "",         // Expected delivery date
    packSlipDate: row["Pack Slip Dt"] || "",                  // Packing slip date

    // Shipping Information
    invoiceDate: row["Invoice Dt"] || "",                     // Invoice date
    invoiceNumber: row["Invoice No"] || "",                   // Invoice number
    truckNumber: row["Truck No"] || "",                       // Vehicle number
    transport: row["Transport"] || "",                        // Transport company

    // Additional Information
    departmentRemark: row["Dept.Remark"] || "",               // Internal department notes
    soSpecialRemark: row["SO SPL.Remark"] || "",              // Special order remarks
    dieIndent: row["DIE Indend"] || "",                       // Die reference

    // Store original row for debugging and reference
    // This preserves all original data in case it's needed later
    raw: row,
  };
};

export default mapFields;
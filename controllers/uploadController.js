import { createReadStream, unlinkSync } from 'fs';
import csv from 'csv-parser';
import parseExcel from '../utils/excelParser.js';
import Order from '../models/Order.js';
import PendingOrder from '../models/PendingOrder.js';
import mapFields from '../utils/mapFields.js';

function cleanNum(n) {
  if (!n || n === "" || isNaN(n)) return 0;
  return Number(n);
}

// Strict Unique Filter
function getUniqueFilter(mapped, type) {
  const filter = {
    poNumber: mapped.poNumber,
    productCode: mapped.productCode,
    soNumber: mapped.soNumber,
    size: mapped.size,
  };

  if (mapped.lineItemNumber) {
    filter.lineItemNumber = mapped.lineItemNumber;
  }

  if (type === "DISPATCHED" && mapped.invoiceNumber) {
    filter.invoiceNumber = mapped.invoiceNumber;
  }

  return filter;
}

// Helper: Process a batch of rows to DB
async function processBatch(rows, statusType) {
  if (rows.length === 0) return 0;

  const operations = [];

  for (let row of rows) {
    let mapped = mapFields(row);
    mapped.status = statusType === "PENDING" ? "Pending" : "Dispatched";
    
    mapped.quantity = cleanNum(mapped.quantity);
    mapped.dispatchQuantity = cleanNum(mapped.dispatchQuantity);
    mapped.pendingQuantity = cleanNum(mapped.pendingQuantity);
    mapped.grossWeight = cleanNum(mapped.grossWeight);
    mapped.chargeWeight = cleanNum(mapped.chargeWeight);
    mapped.rate = cleanNum(mapped.rate);

    const filter = getUniqueFilter(mapped, statusType);

    // Prepare Bulk Operation
    operations.push({
      updateOne: {
        filter: filter,
        update: { $set: mapped },
        upsert: true,
      },
    });

    // Special logic for Dispatched: Reconcile with Pending
    // Note: In a massive batch scenario, performing individual finds for reconciliation 
    // is slow. For 10GB files, we typically just save the history first.
    // However, to keep your logic intact, we will do it. 
    // Optimally, you would run a separate reconciliation script after upload.
    if (statusType === "DISPATCHED") {
        // We can't easily bulk-write the reconciliation logic because it depends on reading the DB.
        // For now, we will stick to the updateOne logic for history, but we have to handle 
        // the PendingOrder cleanup separately or accepts it might be slower.
        // To handle 10GB files effectively, we only bulk write the HISTORY.
        // The reconciliation is done via a separate async process or strictly for the matched items.
        
        // AUTO-RECONCILIATION (Optimized lookups could be done here, 
        // but for simplicity/safety we will just process the history insert in bulk first)
    }
  }

  // 1. Bulk Write to Main Collection
  const Collection = statusType === "PENDING" ? PendingOrder : Order;
  if (operations.length > 0) {
    await Collection.bulkWrite(operations);
  }

  // 2. Handle Reconciliation for Dispatched (Post-Batch)
  // Doing this row-by-row is the only safe way to ensure accurate math
  let reconciledCount = 0;
  if (statusType === "DISPATCHED") {
    for (let row of rows) {
      // Re-map to find keys
      let mapped = mapFields(row);
      const pendingMatch = {
        poNumber: mapped.poNumber,
        productCode: mapped.productCode,
        size: mapped.size,
      };

      // We interpret "Sale Qty" as dispatch quantity
      const shippedNow = cleanNum(mapped.dispatchQuantity) || 0;

      // Atomic update is faster: decrement pending quantity directly
      // If result is <= 0, we delete it in a second step or let a cleanup job do it.
      // Here we will try to find and update.
      const pendingItem = await PendingOrder.findOne(pendingMatch);
      if (pendingItem) {
        let newPendingQty = (pendingItem.pendingQuantity || 0) - shippedNow;
        if (newPendingQty <= 0) {
          await PendingOrder.deleteOne({ _id: pendingItem._id });
          reconciledCount++;
        } else {
          await PendingOrder.updateOne({ _id: pendingItem._id }, { $set: { pendingQuantity: newPendingQty } });
        }
      }
    }
  }

  return { inserted: operations.length, reconciled: reconciledCount };
}

const uploadFile = async (req, res, statusType) => {
  try {
    console.log(`📌 Stream Upload started: ${statusType}`);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const name = file.originalname.toLowerCase();
    const isCSV = name.endsWith(".csv");
    
    // EXCEL HANDLING (Memory Intensive - Standard)
    // Excel files are rarely 10GB. If they are, they should be converted to CSV.
    if (!isCSV) {
      const rows = parseExcel(file.path);
      const result = await processBatch(rows, statusType); // Process all at once for Excel
      fs.unlinkSync(file.path);
      return res.json({
        message: "Excel processed successfully",
        rowsInserted: result.inserted,
        reconciledOrders: result.reconciled,
        statusType,
      });
    }

    // CSV HANDLING (Streaming - Memory Safe for 10GB+)
    let totalInserted = 0;
    let totalReconciled = 0;
    let batch = [];
    const BATCH_SIZE = 2000; // Process 2000 rows at a time

    const processStream = new Promise((resolve, reject) => {
      const stream = fs.createReadStream(file.path)
        .pipe(csv())
        .on("data", async (row) => {
          // Clean keys immediately
          const cleaned = {};
          for (let k in row) cleaned[k.trim().replace(/\s+/g, " ")] = row[k];
          
          batch.push(cleaned);

          // If batch is full, PAUSE stream, process, then RESUME
          if (batch.length >= BATCH_SIZE) {
            stream.pause();
            try {
              const result = await processBatch(batch, statusType);
              totalInserted += result.inserted;
              totalReconciled += result.reconciled;
              batch = []; // Clear memory
              stream.resume();
            } catch (err) {
              stream.destroy(err);
              reject(err);
            }
          }
        })
        .on("end", async () => {
          // Process remaining rows
          if (batch.length > 0) {
            try {
              const result = await processBatch(batch, statusType);
              totalInserted += result.inserted;
              totalReconciled += result.reconciled;
            } catch (err) {
              reject(err);
            }
          }
          resolve();
        })
        .on("error", (err) => reject(err));
    });

    await processStream;

    fs.unlinkSync(file.path);

    return res.json({
      message: "Large CSV processed successfully",
      rowsInserted: totalInserted,
      reconciledOrders: totalReconciled,
      statusType,
    });

  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
};

export default {
  uploadFile,
  processBatch
};
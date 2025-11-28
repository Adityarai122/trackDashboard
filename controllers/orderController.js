import Order from '../models/Order.js';
import PendingOrder from '../models/PendingOrder.js';

// Helper to build queries
const buildQuery = (q, filters) => {
  let query = {};
  
  if (q && q.trim() !== "") {
    const regex = new RegExp(q, "i");
    query.$or = [
      { poNumber: regex },
      { soNumber: regex },
      { productCode: regex },
      { partNumber: regex },
      { customerName: regex },
      { lineItemNumber: regex }
    ];
  }

  if (filters.customer) query.customerName = new RegExp(filters.customer, "i");
  if (filters.poNumber) query.poNumber = new RegExp(filters.poNumber, "i");

  if (filters.startDate || filters.endDate) {
    query.orderDate = {};
    if (filters.startDate) query.orderDate.$gte = filters.startDate;
    if (filters.endDate) query.orderDate.$lte = filters.endDate;
  }

  return query;
};

// --- API ENDPOINTS ---

// 1. UPDATED: Dashboard Analytics
async function getDashboardStats(req, res) {
  try {
    const { range } = req.query; // Get range from frontend (1D, 1W, 1M, 6M, 1Y)

    // A. Pending Stats
    const pendingStats = await PendingOrder.aggregate([
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalValue: { $sum: { $multiply: ["$pendingQuantity", "$rate"] } },
          totalQuantity: { $sum: "$pendingQuantity" }
        }
      }
    ]);

    // B. Dispatched Stats (Lifetime)
    const dispatchedStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalValue: { $sum: { $multiply: ["$dispatchQuantity", "$rate"] } },
          totalQuantity: { $sum: "$dispatchQuantity" }
        }
      }
    ]);

    // C. UPDATED: Today's Activity (Fix for "0" value)
    // We now check BOTH 'createdAt' and 'updatedAt'. 
    // This ensures we catch new uploads (createdAt) AND modified records (updatedAt).
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayDispatchStats = await Order.aggregate([
      { 
        $match: { 
          $or: [
            { createdAt: { $gte: startOfDay } }, // Newly uploaded today
            { updatedAt: { $gte: startOfDay } }  // Updated today
          ]
        } 
      }, 
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalValue: { $sum: { $multiply: ["$dispatchQuantity", "$rate"] } },
        }
      }
    ]);

    // D. Top 5 Customers by Pending Value
    const topCustomers = await PendingOrder.aggregate([
      {
        $group: {
          _id: "$customerName",
          count: { $sum: 1 },
          value: { $sum: { $multiply: ["$pendingQuantity", "$rate"] } }
        }
      },
      { $sort: { value: -1 } },
      { $limit: 5 }
    ]);

    // E. Active Customers
    const activeCustomers = await PendingOrder.distinct("customerName");

    // F. Dynamic Dispatch Trend
    let limit = 30; // Default 1 Month
    if (range === '1W') limit = 7;
    if (range === '6M') limit = 180;
    if (range === '1Y') limit = 365;
    if (range === '1D') limit = 1;

    const dailyTrend = await Order.aggregate([
        {
            $group: {
                _id: "$dispatchDate", // Group by Day for the graph
                orders: { $sum: 1 },
                value: { $sum: { $multiply: ["$dispatchQuantity", "$rate"] } }
            }
        },
        { $sort: { _id: -1 } }, 
        { $limit: limit },      
        { $sort: { _id: 1 } }   
    ]);

    res.json({
      pending: pendingStats[0] || { totalCount: 0, totalValue: 0, totalQuantity: 0 },
      dispatched: dispatchedStats[0] || { totalCount: 0, totalValue: 0, totalQuantity: 0 },
      today: todayDispatchStats[0] || { totalCount: 0, totalValue: 0 },
      topCustomers: topCustomers.map(c => ({ name: c._id || "Unknown", value: c.value, count: c.count })),
      trend: dailyTrend.map(t => ({ name: t._id || "N/A", orders: t.orders, value: t.value })),
      activeCustomerCount: activeCustomers.length,
      rangeUsed: range || '1M'
    });

  } catch (err) {
    console.error("Stats Error:", err);
    res.status(500).json({ error: "Failed to generate analytics" });
  }
};

// 2. Advanced Master Search
async function searchOrders(req, res) {
  try {
    const { q, startDate, endDate, customer, poNumber } = req.query;
    const filters = { startDate, endDate, customer, poNumber };
    const query = await buildQuery(q, filters);

    const [pendingResults, historyResults] = await Promise.all([
      PendingOrder.find(query).limit(50),
      Order.find(query).limit(50)
    ]);

    const pendingTagged = pendingResults.map(o => ({ ...o._doc, source: "PENDING", status: "Pending" }));
    const historyTagged = historyResults.map(o => ({ ...o._doc, source: "HISTORY", status: "Dispatched" }));

    res.json([...pendingTagged, ...historyTagged]);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
};

// 3. Get All History (Grouped)
async function getAllOrders(req, res) {
  try {
    const pipeline = [
      { $sort: { createdAt: -1 } },
      { $limit: 500 },
      {
        $group: {
          _id: "$customerName",
          count: { $sum: 1 },
          orders: { $push: "$$ROOT" }
        }
      },
      { $sort: { count: -1 } }
    ];
    const data = await Order.aggregate(pipeline);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// 4. Get Open/Pending Orders (Grouped)
async function getPendingOrders(req, res) {
  try {
    const { customer, part, dueToday } = req.query;
    let matchStage = {};

    if (customer) matchStage.customerName = new RegExp(customer, "i");
    if (part) {
      const regex = new RegExp(part, "i");
      matchStage.$or = [{ partNumber: regex }, { productCode: regex }];
    }
    if (dueToday === "true") {
      const today = new Date().toISOString().split("T")[0];
      matchStage.expectedDeliveryDate = new RegExp(today, "i"); 
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { expectedDeliveryDate: 1 } },
      {
        $group: {
          _id: "$customerName",
          count: { $sum: 1 },
          orders: { $push: "$$ROOT" }
        }
      },
      { $sort: { count: -1 } }
    ];

    const data = await PendingOrder.aggregate(pipeline);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending orders" });
  }
};

// Export all controller functions as default
export default {
  getDashboardStats,
  searchOrders,
  getAllOrders,
  getPendingOrders,
  buildQuery // Exporting helper function if needed by other modules
};
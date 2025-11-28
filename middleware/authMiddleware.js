const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

module.exports = (req, res, next) => {
  // Get token from header
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ error: "No token, authorization denied" });
  }

  try {
    // Verify token
    // Remove "Bearer " if sent in that format
    const cleanToken = token.replace("Bearer ", "");
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
    
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token is not valid" });
  }
};
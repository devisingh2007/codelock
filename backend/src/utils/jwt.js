const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "1h";

const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  signToken,
  verifyToken,
};

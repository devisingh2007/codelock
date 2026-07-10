// JWT Authentication Middleware Placeholder

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    // In the future, verify token here
    // For now, allow pass through
    next();
  } else {
    res.status(401).json({ message: "Authorization token required" });
  }
};

module.exports = authenticateJWT;

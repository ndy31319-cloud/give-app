const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "give-local-development-secret";

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "로그인이 필요한 서비스입니다." });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "유효하지 않거나 만료된 토큰입니다." });
    }

    req.user = user;
    return next();
  });
};

module.exports = authenticateToken;

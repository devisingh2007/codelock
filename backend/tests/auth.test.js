const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const app = require("../server");
const User = require("../src/models/User");
const { signToken } = require("../src/utils/jwt");

// Mock the Database connection config to avoid real DB calls
jest.mock("../src/config/db", () => jest.fn().mockResolvedValue(true));

// Mock User model methods
jest.mock("../src/models/User");

// Close any open handles after all tests
afterAll(async () => {
  // If there are any connection listeners registered, we close them.
  if (mongoose.connection && mongoose.connection.close) {
    await mongoose.connection.close();
  }
});

describe("Auth API Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    test("should successfully register a new user", async () => {
      // Mock that email doesn't exist yet
      User.findOne.mockResolvedValue(null);
      // Mock saving user
      User.prototype.save = jest.fn().mockResolvedValue({
        _id: "mockuserid123",
        username: "testuser",
        email: "test@example.com",
      });

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          email: "test@example.com",
          password: "password123",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("token");
    });

    test("should return 400 when registering with duplicate email", async () => {
      // Mock that email already exists
      User.findOne.mockResolvedValue({
        _id: "existinguser123",
        email: "test@example.com",
      });

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          email: "test@example.com",
          password: "password123",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("already exists");
    });

    test("should return 400 for invalid validation inputs", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "us", // Less than 3 chars
          email: "not-an-email",
          password: "short", // Less than 8 chars
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("POST /api/auth/login", () => {
    test("should successfully login with valid credentials", async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      User.findOne.mockResolvedValue({
        _id: "mockuserid123",
        username: "testuser",
        email: "test@example.com",
        password: hashedPassword,
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "test@example.com",
          password: "password123",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("token");
    });

    test("should return 401 with wrong credentials", async () => {
      User.findOne.mockResolvedValue(null); // User not found

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "wrong@example.com",
          password: "wrongpassword",
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain("Invalid email or password");
    });
  });

  describe("GET /api/auth/profile", () => {
    test("should successfully return user profile when valid token provided", async () => {
      const token = signToken({ id: "mockuserid123" });
      
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          username: "testuser",
          email: "test@example.com",
          createdAt: new Date(),
        }),
      });

      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("username", "testuser");
      expect(res.body).toHaveProperty("email", "test@example.com");
      expect(res.body).not.toHaveProperty("password");
    });

    test("should return 401 when no token is provided", async () => {
      const res = await request(app).get("/api/auth/profile");

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain("No token provided");
    });
  });
});

// import express from "express";
// import { login, register, verifyEmailLink, verifyOtp } from "../controllers/authController.js";
// import upload from "../middleware/upload.js";

// const router = express.Router();

// router.post("/register",upload.single("profileImage"), register);
// router.post("/verify-otp", verifyOtp);
// router.get("/verify-email/:token", verifyEmailLink);
// router.post("/login", login);


// export default router;




import express from "express";
import {
  register,
  login,
  verifyOtp,
  verifyEmailLink,
  updateProfile,
  getUserByEmail
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.post("/register", upload.single("profileImage"), register);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);
router.get("/verify-email/:token", verifyEmailLink);

router.put(
  "/update-profile",
  authMiddleware,
  upload.single("profileImage"),
  updateProfile
);

// Get user by email (for messaging)
router.get("/find/:email", getUserByEmail);

export default router;


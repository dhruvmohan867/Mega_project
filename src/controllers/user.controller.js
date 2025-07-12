// ***********************************************
// Auth Controller (annotated)
// ***********************************************
// This module exposes three controller functions:
// 1. registerUser – Sign‑up endpoint
// 2. loginUser    – Sign‑in endpoint
// 3. logoutUser   – Sign‑out endpoint
// Each function is wrapped with asyncHandler so that any
// uncaught promise rejections are forwarded to your central
// Express error‑handling middleware.
// ***********************************************

// ────────────────────────────────────────────────
// External Dependencies
// ────────────────────────────────────────────────
import { asyncHandler } from "../utils/asyncHandler.js"; // Catches async errors and passes them to next()
import { ApiError }   from "../utils/ApiError.js";      // Custom error class → { statusCode, message }
import { User }       from "../models/user.model.js";    // Mongoose user schema & model
import { uploadCloudinary } from  "../utils/cloudinary.js"; // Helper that uploads a local file path to Cloudinary and returns { url, ... }
import { ApiResponse } from "../utils/ApiResponce.js";   // Standard success envelope  { statusCode, data, message }



// ────────────────────────────────────────────────
// 1.  Register User
// Route   : POST /api/v1/auth/register
// Access  : Public
// Purpose : Creates a new user record, uploads avatar & cover images
// ────────────────────────────────────────────────
const registerUser = asyncHandler(async (req, res) => {
    // Destructure expected fields from the request body
    const { username, email, password, fullname } = req.body;

    // DEBUG: Log incoming values to server console for quick inspection
    console.log("email", email);
    console.log("username", username);
    console.log("password", password);
    console.log("full name", fullname);
   
    // Extract file paths from Multer‑processed uploads (if any)
    // req.files has shape: { avatar: [ { path: "..." } ], coverImage: [ { path: "..." } ] }
    const avatarLocalPath      = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath  = req.files?.coverImage?.[0]?.path;

    console.log("req.body:",   req.body);
    console.log("req.files:",  req.files);
    console.log("coverImageLocalPath", coverImageLocalPath);
    console.log("avatarLocalPath",     avatarLocalPath);

    // ── Validation ────────────────────────────────
    // Ensure all text fields are present and non‑empty
    if ([username, email, password, fullname].some(field => !field || field.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    // Check for existing account with same email OR username (case sensitive for email, lower‑cased later for username)
    const existedUser = await User.findOne({
        $or: [{ email }, { username }]
    });
    if (existedUser) {
        throw new ApiError(409, "User already exists with this email or username");
    }

    // Both avatar and cover image must be provided by the client
    if (!avatarLocalPath || !coverImageLocalPath) {
        throw new ApiError(400, "Avatar and cover image are required");
    }

    // ── Upload assets to Cloudinary ─────────────────
    const avatar = await uploadCloudinary(avatarLocalPath);     // returns { url, public_id, ... }
    const coverImage = await uploadCloudinary(coverImageLocalPath); // same structure

    if (!avatar || !coverImage) {
        // If either upload failed, treat as server error
        throw new ApiError(500, "Failed to upload images");
    }

    // ── Persist user in MongoDB ─────────────────────
    const user = await User.create({
        fullname,
        avatar:      avatar.url,      // Cloudinary URL for avatar
        coverImage:  coverImage.url,  // Cloudinary URL for cover photo
        email,
        password,                     // Will be hashed by a pre‑save hook inside user model
        username:    username.toLowerCase() // Normalise username for case‑insensitive lookups
    });

    // Retrieve fresh document without sensitive fields
    const createdUser = await User.findById(user._id).select("-password -refreshtoken");
    if (!createdUser) {
        throw new ApiError(500, "User not created");
    }

    // Respond 201 with wrapped ApiResponse
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User created successfully")
    );
});

// ────────────────────────────────────────────────
// 2.  Login User
// Route   : POST /api/v1/auth/login
// Access  : Public
// Purpose : Verify credentials, issue JWT access & refresh tokens
// ────────────────────────────────────────────────
const loginUser = asyncHandler(async (req, res) => {
    // Extract credentials
    const { email, username, password } = req.body;

    // Basic input validation
    if (!email && !username) {
        // At least one identifier is required
        throw new ApiError(400, "Email or Username are required");
    }

    // Attempt to locate user by email OR username
    const user = await User.findOne({
        $or: [{ email }, { username }]
    });
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Verify plaintext password against hashed password stored in DB – implemented as instance method on schema
    const isPasswordMatch = await user.isPasswordCorrect(password);
    if (!isPasswordMatch) {
        throw new ApiError(401, "Invalid credentials");
    }

    // Helper function to generate signed JWTs and persist refresh token inside DB
    const generateAccessAndRefreshToken = async (userId) => {
        try {
            const user = await User.findById(userId);

            // Instance methods defined on schema (e.g., user.generateAccessToken()) return signed tokens
            const accessToken  = user.generateAccessToken();
            const refreshToken = user.generateRefreshToken();

            // Persist the new refresh token
            user.refreshtoken = refreshToken;
            await user.save({ validateBeforeSave: false });

            return { accessToken, refreshToken };
        } catch (error) {
            throw new ApiError(500, "Error generating tokens");
        }
    };

    // Issue tokens for this session
    const { refreshToken, accessToken } = await generateAccessAndRefreshToken(user._id);

    // Omit sensitive fields before sending user back to client
    const createdUser = await User.findById(user._id).select("-password -refreshtoken");

    // Cookie options – httpOnly prevents JS access, secure ensures HTTPS, sameSite=None allows cross‑site if needed
    const options = {
        httpOnly: true,
        secure:   true
        // sameSite intentionally not set to allow default (can adjust based on front‑end origin)
    };

    // NOTE: There is a typo in the following chain – `.cokkie` should be `.cookie`.
    //       Without fixing, Express will throw a TypeError.

    return res
        .status(200)
        .cookie("accessToken",  accessToken,  options)  // Set short‑lived access token
        .cookie("refreshToken", refreshToken, options)  // Set long‑lived refresh token
        .json(new ApiResponse(200, { user: createdUser, accessToken, refreshToken }, "Login successful"));
});

// ────────────────────────────────────────────────
// 3.  Logout User
// Route   : POST /api/v1/auth/logout
// Access  : Private (requires auth middleware to populate req.user)
// Purpose : Invalidate server‑side refresh token and clear client cookies
// ────────────────────────────────────────────────
const logoutUser = asyncHandler(async (req, res) => {
    // Remove refresh token from DB so it can no longer be used to obtain new access tokens
    await User.findByIdAndUpdate(
        req.user._id,
        { $set: { refreshtoken: undefined } },
        { new: true }
    );

    // Same cookie settings used during login (must match for browser to recognise cookie)
    const options = {
        httpOnly: true,
        secure:   true,
        sameSite: "None" // Required for third‑party contexts when secure=true
    };

    // Clear both cookies by setting them to null with same options & an immediate expiry (default when value = null)
    return res
        .status(200)
        .cookie("accessToken",  null, options)
        .cookie("refreshToken", null, options)
        .json(new ApiResponse(200, null, "Logout successful"));
});

// Export controller functions for use in routes
export { registerUser, loginUser, logoutUser };

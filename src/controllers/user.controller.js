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
import jwt from "jsonwebtoken"; // For generating JWT tokens

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
    const { email, username, password } = req.body;

    if (!email && !username) {
        throw new ApiError(400, "Email or Username is required");
    }

    const user = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isPasswordMatch = await user.isPasswordCorrect(password);
    if (!isPasswordMatch) {
        throw new ApiError(401, "Invalid credentials");
    }

    // ✅ Generate tokens using instance methods
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // ✅ Save refresh token to DB
    user.refreshtoken = refreshToken;
    await user.save({ validateBeforeSave: false });

    const createdUser = await User.findById(user._id).select("-password -refreshtoken");

    // ✅ Set secure cookie options
    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "None" // use this if you're testing cross-site or HTTPS
    };

    // ✅ Send cookies and response
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
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
        .cookie("accessToken",  undefined, options)
        .cookie("refreshToken", undefined, options)
        .json(new ApiResponse(200, null, "Logout successful"));
});
const refreshAccessToken = asyncHandler(async (req, res) => {

    const refreshToken12= req.cookies.refreshToken || req.body.refreshToken;
    if (!refreshToken12) {
        throw new ApiError(401, "Refresh token is required");
    }
    // Verify the refresh token
    try {
        const decodedToken = jwt.verify(refreshToken12, process.env.REFRESH_TOKEN_SECRET)
        const user =  await  User.findById(decodedToken._id)
        if(!user){
            throw new ApiError(401, "Invalid refresh token");
        }
        if(refreshToken12 !== user.refreshtoken){
            throw new ApiError(401, "Refresh token is expired or used");
        }
        const options = {
            httpOnly: true,
            secure: true,
            sameSite: "None" // Required for third‑party contexts when secure=true
        };
        const {accessToken, newrefreshToken} = await generateAccesAndRefreshTokens(user._id);
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("newrefreshToken", newrefreshToken, options)
            .json(new ApiResponse(200, { accessToken, newrefreshToken }, "Access token refreshed successfully"));
    } catch (error) {
        throw new ApiError(401, "Invalid refresh token");
    }
})

// Export controller functions for use in routes
export { registerUser, loginUser, logoutUser , refreshAccessToken };

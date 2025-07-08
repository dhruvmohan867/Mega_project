import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import {uploadCloudinary} from  "../utils/cloudinary.js";
import { ApiResponse  } from "../utils/ApiResponce.js";
const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password, fullname } = req.body;
    console.log("email", email);
    console.log("username", username);
    console.log("password", password);
    console.log("full name", fullname);
    if ([username, email, password, fullname].some(field => !field || field.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }
    const existedUser = User.findOne({
         $or: [{ email } , {username}]
    });
    if (existedUser) {
        throw new ApiError(409, "User already exists with this email");
    }
    const avatarLocalPath = res.files?.avatar[0]?.path
    const coverImageLocalPath = res.files?.coverImage[0]?.path
    console.log("coverImageLocalPath", coverImageLocalPath);
    console.log("avatarLocalPath", avatarLocalPath);
    console.log("He is here " , res.files)
    if(!avatarLocalPath || !coverImageLocalPath){
        throw new ApiError(400, "Avatar and cover image are required");
    }
    const avatar = await uploadCloudinary(avatarLocalPath);
    const coverImage = await uploadCloudinary(coverImageLocalPath); 
    if (!avatar || !coverImage) {
        throw new ApiError(500, "Failed to upload images");
    } 
    const user = await User.create({
    fullname,
    avatar: avatar.url, 
    coverImage: coverImage.url,  
    email,
    password,
    username : username.toLowerCase()    
    });

  const createdUser = await User.findById(user._id).select("-password -refreshtoken");
  if(!createdUser){
      throw new ApiError(500, "User not created");
  }
   return res.status(201).json(
    new ApiResponse(200, createdUser, "User created successfully")
   );
}); 

export { registerUser } 
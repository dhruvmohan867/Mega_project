import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'
  cloudinary.config({ 
        cloud_name: process.env.Cloud_name, 
        api_key: process.env.Api_key , 
        api_secret: process.env.Api_secret

// ' // Click 'View API Keys' above to copy your API secret
    });

const uploadCloudinary = async(localFilePath)=>{
   try{
     if (!localFilePath){
      return null;
    }
     const response = await cloudinary.uploader.upload(localFilePath,{
         resource_type : "auto"
     })
     console.log("File upload ho gyi hai")
     console.log(response.url)
     fs.unlinkSync(localFilePath) // Delete the local file after upload
     return response;
   }
   catch(error){
      fs.unlink(localFilePath)
      return null
   }
}
export {uploadCloudinary}
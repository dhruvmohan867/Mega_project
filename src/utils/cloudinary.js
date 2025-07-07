import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'
  cloudinary.config({ 
        cloud_name: process.env.Cloud_name, 
        api_key: process.env.Api_key , 
        api_secret: process.env.Api_secret

// ' // Click 'View API Keys' above to copy your API secret
    });
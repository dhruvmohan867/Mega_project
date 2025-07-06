import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'
  cloudinary.config({ 
        cloud_name: process.env.api_secret, 
        api_key: process.env.api_key , 
        api_secret: 'eso6ca4PPXwTm14ya_uxvV1_Ad0'

// ' // Click 'View API Keys' above to copy your API secret
    });
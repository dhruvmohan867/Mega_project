import mongoose from 'mongoose'
import dotenv from 'dotenv'
import express from 'express'
import { DB_NAME } from './constants.js';
import connectDB from './db/index.js';
 
// const app = express()
dotenv.config({
    path:'./env'
})
connectDB()
// (async ()=>{
//    try {
//     await  mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
//     app.on("error",(error)=>{
//         console.log("Error:" , error);
//         throw error
//     })
//     app.listen(process.env.PORT , ()=>{
//           console.log(`App is listnering on port ${process.env.PORT}`);
          
//     })
//    } catch (error) {
//      console.log('Error :', error);
//      throw err
//    }
// })()
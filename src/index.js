import mongoose from 'mongoose'
// import dotenv from 'dotenv'
import express from 'express'
import { DB_NAME } from './constants.js';
import connectDB from './db/index.js';
 

connectDB()
.then(()=>{
     app.listen(process.env.PORT || 8000, ()=>{
       console.log(`Server is running at port :${process.env.PORT}`)
     })
})
.catch((error)=>{
    console.log(`Mongo Db is failled`)
})
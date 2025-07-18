import mongoose , {Schema} from 'mongoose'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
const userSchema = new Schema({
  username :{
    type : String,
    required : true,
    unique : true,
    index : true
  },
  email :{
     type : String,
    required : true,
    unique : true
    },
  fullname :{
    type : String,
    required : true,
    trim : true,
    index : true
  },
  avatar :{
    type : String ,
    requried : true
  },
  coverImage:{
    type : String,
    required : true
  },
  watchHistory : [{
    type : mongoose.Schema.Types.ObjectId,
    ref : "Video"
  }],
  password :{
    type : String,
    required : [true , "Password is required"]
  },
  refreshtoken : {
     type : String
  }
},{timestamps:true})
userSchema.pre("save",async function(next){
    if(!this.isModified("password")) return next();
    this.password= await bcrypt.hash(this.password,10)
    next()
})
userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password,this.password)
}
userSchema.methods.generateAccessToken = function(){
   return  jwt.sign({
        _id:this._id,
        email : this.email,
        username : this.username,
        fullname : this.fullname
    },
     process.env.ACCESS_TOKEN_SECRET,
     {
        expiresIn : process.env.ACCESS_TOKEN_ENTRY
     }
)
}
userSchema.methods.generateRefreshToken = function(){
     return  jwt.sign({
        _id:this._id,
        email : this.email,
        username : this.username,
        fullname : this.fullname
    },
     process.env.REFRESH_TOKEN_SECRET,
     {
        expiresIn : process.env.REFRESH_TOKEN_ENTRY 
     }
    )
}
export const User = mongoose.model("User",userSchema)
import mongoose from 'mongoose'
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2'
const VideoSchema = mongoose.Schema ({
    videofile :{
       type : String,
       required : true
    },
    thumbnail :{
        type : String,
        required : true
    },
    owner :{
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    title :{
        type : String,
        required : true
    },
    description :{
        type: String,

    },
    duration :{
        type : Number,
        required: true
    },
    views :{
        type : Number,
         required : true,
         default:0
    },
    isPublish:{
        type : Boolean,
        default : true
    },
   
},{timestamps:true})
VideoSchema.plugin(mongooseAggregatePaginate)



export const Video = mongoose.model("Video", VideoSchema)
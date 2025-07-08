const  asyncHandler = (fn)=>(
     async (req, res , next)=>{
        try{
            await fn (req,res,next)
        }catch(err){
            next(err) // Pass error to global error handler
        }
     }
 )
export {asyncHandler}
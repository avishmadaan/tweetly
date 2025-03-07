import { Request, Response, NextFunction, Router } from "express";
import passport from "../configuration/passportConfig"; 
import authMiddleware from "../middlewares/auth-middleware";
import { MAIN_URL, prisma } from "../config";


const twitterRouter:Router = Router();
twitterRouter.use(authMiddleware)

twitterRouter.get(
    "/auth/twitter",
    
    passport.authenticate("twitter")
  );


  twitterRouter.get(
    "/auth/twitter/callback",
    
    passport.authenticate("twitter", {
        failureRedirect: "/dashboard/home",
       // Redirect to dashboard after successful linking
    }),  async  (req: Request, res: Response) => {

       try {

        res.send(`
            <script>
            window.opener.postMessage({
            login:true, message:"X Integrated Successfully"
            }, '${MAIN_URL}')
            window.close();

            </script>
            `)


       }

       catch(e) {

        console.log(e);
 
          res.send(`
            <script>
                window.opener.postMessage({ login: false, message:"Internal Server Error" }, ${MAIN_URL});
                window.close();
            </script>
        `);

       }

    }
);


twitterRouter.get("/twitter/accountinfo", authMiddleware, async (req: Request, res: Response) => {

    try {

        //@ts-ignore
        const userId = req.userId;

    const account = await prisma.twitter.findUnique({
        where:{
            userId
        },
    })


    if(!account) {
        res.status(404).json({
            message:"No Twitter Account Found",
        
        })
        return;
    }

    res.status(201).json({
        message:"Account Details Fetched",
        account

    })

}

catch(e) {
    console.log(e);
    res.status(500).json({
        message:"Internal Server Error",

    })


}
})

twitterRouter.post("/twitter/delete", authMiddleware, async (req , res) => {

    try {
        //@ts-ignore
        const userId = req.userId;
        const id = req.body.twitterId;

        console.log("Twitter Deletion")

        const result = await prisma.twitter.delete({
            where:{
                userId,
                id
            }
        })

        res.status(200).json({
            message:"Twitter Account Disconnected",
            id:result.twitterId
        })

    }catch(err) {
        console.log(err);
        res.status(500).json({
            message:"Internal Server Error",
    
        })
    }

})

export default twitterRouter
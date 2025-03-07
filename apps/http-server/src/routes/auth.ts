import { Request, Response, Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt"
import { JWT_SECRET, MAIN_URL, NODE_ENV, prisma } from "../config";
import jwt from "jsonwebtoken";
import authMiddleware from "../middlewares/auth-middleware";
import { sendOTPEmail, sendPasswordResetConfirmationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../emailer";
import passport from "../configuration/passportConfig"; 
import { otpGenerator } from "../utils/otpgeneration";


const userRouter:Router = Router();


userRouter.post("/signup", async (req, res) => {
 
    
    const requiredBody = z.object({
        email:z.string().email(),
        password:z.string().min(8, {message:"Minimum length is 8"}).max(20).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/, {
            message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
        })

    })
    const parsedData = requiredBody.safeParse(req.body);
    
    if(!parsedData.success) {
        res.status(411).json({
            message:"Error in inputs",
            error: parsedData.error,
        })
        return;
    }

    const email = req.body.email;
    const password =  req.body.password;

    const hashedPassword = await bcrypt.hash(password,10);

    try {
        await prisma.user.create({
            data:{
                email,
                password:hashedPassword
            }
        })

          // Send a welcome email without blocking the response
          sendWelcomeEmail(email).catch(err => {
            console.error("Failed to send welcome email:", err);
        });

        res.status(200).json({
            message:"Account Creation Success"
        })


    }

    catch(e:any){


        //@ts-ignore
        if(e.code === "P2002") {

            res.status(409).json({
             message:"User already exists with this email"
            })

        }

        else {

            res.status(500).json({
                message:"Server error"
               })

        }

    }



})


userRouter.post("/login", async (req, res)=> {

    const email = req.body.email;
    const password =  req.body.password;

    const user = await prisma.user.findFirst({
        where:{
            email
        }
    })

    if(!user) { 

        res.status(403).json({
            message:"User Does Not Exist"
        });

        return;
    }

    const comparePassword = await bcrypt.compare(password, user.password as string)



    try {
   
        if(comparePassword) {

            console.log("userId Here")
            console.log(user.id);
            const token = jwt.sign({
               id: user.id.toString(),

            }, JWT_SECRET as string);

            await prisma.token.create({
                data:{
                    userId:user.id,
                    token:token
                    
                }
            })

            res.status(200).json({
                message:"Signin Success",
                token
            })
        }

        else {
            res.status(411).json({
                message:"Incorrect Password"
            })
        }

    }

    catch(e){
        console.log(e);

       res.status(500).json({
        message:"Internal Server Error"
       })
    }




    })

    userRouter.post("/logout", async (req, res)=> {

        const token = req.cookies.auth_token;
 

        if(!token) {
            res.status(404).json({ message: "Token Missing" });
            return ;
        }

        try {

            await prisma.token.deleteMany({
                where:{
                    token
                }
            })

            req.session.destroy((err) => {
                if(err) {
                    console.log("session destruction error", err);

                    res.status(500).json({
                        message:"Failed To Log Out"
                    })
                }
            })

            res.clearCookie("auth_token", {
                path: "/",
                domain: process.env.NODE_ENV === "production" ? ".tweetly.in" : undefined,
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                secure: process.env.NODE_ENV === "production"
              });
              res.clearCookie("connect.sid", {
                path: "/",
                domain: process.env.NODE_ENV === "production" ? ".tweetly.in" : undefined,
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                secure: process.env.NODE_ENV === "production"
              });

            res.status(200).json({ message: "Logged out successfully" });

        }

        catch(e) {
            console.log(e);
            res.status(500).json({
                message:"Internal Server Error"
               })


        }
      
        


    })

    userRouter.post("/paid",authMiddleware, async (req, res)=> {

res.status(200).json({
    message:"You accessed it "
})

    })

    userRouter.get("/google", 
        
        passport.authenticate("google", {
            scope:["profile", "email"]
            
        })
        
    )


    userRouter.get("/google/callback",
        passport.authenticate('google', { failureRedirect: "/login" }),
       async  (req: Request, res: Response) => {
//This route runs whey are done with profile function ( basically last function)

console.log("insde the last callback")

try {


            const user = req.user as { id: string };  
    
            if (!user) {
                 res.status(400).json({ 
                    message: "User not found" 
                });
                 return ;
            }
    
            // Generate JWT token
            const token = jwt.sign(
                { id: user.id },
                JWT_SECRET as string, 
                { expiresIn: '1d' }
            );
            const isProduction = (NODE_ENV === "production");
            console.log("isProduction :", isProduction);
            res.cookie("auth_token", token, 
                {
                    expires:new Date(Date.now() + 7*24*60*60*1000),
                    path:"/",
                    domain: isProduction?".tweetly.in":undefined,
                    sameSite:isProduction?"none":"lax",
                    secure: isProduction
                }
            );
            await prisma.token.create({
                data:{
                    userId:user.id,
                    token:token            
                }
            })


            res.send(`
                <script>
                window.opener.postMessage({
                success:true, message:"Login Successfull"
                }, '${MAIN_URL}')
                window.close();

                </script>
                `)

        }

    
    catch(e) {

        console.log(e);
          // Return an error response
          res.send(`
            <script>
                window.opener.postMessage({ success: false, message:"Internal Server Error" }, ${MAIN_URL});
                window.close();
            </script>
        `);


    }
  }  );

  userRouter.post("/otp/signup", async (req, res) => {

    const requiredBody = z.object({
        name:z.string().min(3, {message:"Minimum length is 3"}),
        email:z.string().email(),
        password:z.string().min(8, {message:"Minimum length is 8"}).max(20).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/, {
            message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
        })

    })

    const parsedData = requiredBody.safeParse(req.body);
    
    if(!parsedData.success) {
        res.status(411).json({
            message:"Error in inputs",
            error: parsedData.error,
        })
        return;
    }
    const name = req.body.name;
    const email = req.body.email;
    const password =  req.body.password;

    const hashedPassword = await bcrypt.hash(password,10);

    try {

        const user = await prisma.user.findUnique({
            where:{
                email:email
            }
        })

        if(user){

            res.status(409).json({
                message:"User already exists with this email"
               })   

               return ;


        }
        const otp = otpGenerator(4);
        console.log("Here is the OTP: " +otp);



        const otpExpiresAt = new Date(Date.now() + 10*60*1000);
        //10 mins time


        await prisma.tempUser.upsert({
            where:{
                email:email
            },
            update:{},
            create:{
                name,
                email,
                password:hashedPassword,
                otp,
                otpExpiresAt:otpExpiresAt

            }
        })
        console.log("above otp email")

       await sendOTPEmail(email, otp);

       res.status(200).json({
        message:"Proceed with OTP Verification",
        email
       })


    }
    catch(e){


            res.status(500).json({
                message:"Internal Server Error"
               })

        

    }

  })

  userRouter.post("/signup/verification", async (req, res) => {

    const email = req.body.email;
    const otp = req.body.otp;

    try {

        const tempUser = await prisma.tempUser.findUnique({
            where:{
                email
            }
        })

        if (!tempUser) {
            res.status(404).json({
                message:"No Such User Exist"
            })
            return;
          }

          if(new Date() > tempUser.otpExpiresAt) {
            res.status(409).json({
                message:"OTP has Expired"
            })
            return;

          }

          if(tempUser.otp !=otp) {
            res.status(411).json({
                message:"Invalid OTP"
            })
            return;

          }

          await prisma.user.create({
            data:{
                name:tempUser.name,
                email,
                password:tempUser.password
            }
        })

                  // Send a welcome email without blocking the response
                  sendWelcomeEmail(email).catch(err => {
                    console.error("Failed to send welcome email:", err);
                });

            await prisma.tempUser.delete({
                where:{
                    email
                }
            });

                res.status(200).json({
                    message:"Account Creation Success"
                })
        

    }

    catch(err) {
 
        res.status(500).json({
            message:"Server error"
           })


    }

  })

  userRouter.post("/signup/verification/newotp", async (req, res) => {

    try {

    const email = req.body.email;
    const otp = otpGenerator(4);
    console.log("Here is the Regerated OTP: " +otp);

    if(!email) {
        res.status(404).json({
            message:"Invalid Request, Email is missing"
           })

           return ;
    
    }
    const otpExpiresAt = new Date(Date.now() + 10*60*1000);

    await prisma.tempUser.update({
        where:{
            email
        },
        data:{
            email,
            otp,
            otpExpiresAt
        }
    })

    await sendOTPEmail(email, otp);

    res.status(200).json({
        message:"OTP Resent Successfully"
       })

}
catch(e) {
    console.log(e);
    res.status(500).json({
        message:"Server error"
       })


}



  })

  userRouter.post("/passwordreset", async (req, res)=> {
  
    const email = req.body.email || " ";
    console.log("email :"+email);
    
        try {
    
            const user = await prisma.user.findUnique({
                where:{
                    email
                }
            })
        
            if(!user) { 
        
                res.status(404).json({
                    message:"User Does Not Exist"
                });
        
                return;
            }

            const token = jwt.sign(
                { id: user.id },
                JWT_SECRET as string, 
                { expiresIn: '30m' }
            );

            await sendPasswordResetEmail(user.email, token);

            
       res.status(200).json({
        message:"Password Reset Email Sent",
        email
       })


    
        }
        catch(e) {
    
            console.log(e);
            res.status(500).json({
                message:"Internal Server error"
               })
    
    
        }
    
      });

userRouter.post("/passwordreset/newpassword",  async (req, res)=> {
  //@ts-ignore
        const token = req.headers.authorization;
        const password = req.body.password;

        if (!token) {
            res.status(401).json({ message: "Token missing" });
            return;
        }
        
            try {

                const decoded = jwt.verify(token as string, JWT_SECRET  as string);

                if(!decoded) {
                    res.status(403).json({
                        message:"Invalid Token"
                    })
                    return;


                }
       
                const user = await prisma.user.findUnique({
                    where:{
                              //@ts-ignore
                       id: decoded.id
                    }
                })
            
                if(!user) { 
            
                    res.status(404).json({
                        message:"User Does Not Exist"
                    });
            
                    return;
                }

                const hashedPassword = await bcrypt.hash(password,10);


                await prisma.user.update({
                    where:{
                        id:user.id
                    },
                    data:{
                        password:hashedPassword
                    }
                })
        
                await sendPasswordResetConfirmationEmail(user.email);
    
                
           res.status(200).json({
            message:"Password Reset Successfull"
           })
    
    
        
            }
            catch(e) {
        
                console.log(e);
                res.status(500).json({
                    message:"Internal Server error"
                   })
        
        
            }
        
          });

  userRouter.get("/getuserdetail", authMiddleware, async (req, res)=> {
//@ts-ignore
    const userID = req.userId;
    console.log(userID);

    try {

        const user = await prisma.user.findUnique({
            where:{
                id:userID
            }
        })
    
        if(!user) { 
    
            res.status(403).json({
                message:"User Does Not Exist"
            });
    
            return;
        }

        res.status(200).json({
            message:"Successfully Fetched Data",
            user
        });

    }
    catch(e) {

        console.log(e);
        res.status(500).json({
            message:"Internal Server error"
           })


    }

  });


  


    

    export default userRouter
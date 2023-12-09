import { config } from "dotenv"
config()
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import morgan from "morgan"
import userRoutes from "./routes/user.routes.js"
import courseRoutes from "./routes/course.route.js"
import paymentRoutes from "./routes/payment.route.js"
import adminRoutes from "./routes/admin.route.js"
import errorMiddleware from "./middleware/erro.middleware.js"

const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }))
app.use((req, res, next) => {
    // Allow all origins (you might want to restrict this in a production environment)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  
    // Continue to the next middleware or route handler
    next();
  });


app.use(morgan("dev"))

app.use("/ping", (req, res) => {
    res.send("/pong")
})

app.use("/api/v1/user", userRoutes)
app.use("/api/v1/courses", courseRoutes)
app.use("/api/v1/payment", paymentRoutes)
app.use("/api/v1/admin", adminRoutes)

app.all("*", (req, res) => {
    res.status(404).send("OOPS! 404 page not found")
})

app.use(errorMiddleware)

export default app
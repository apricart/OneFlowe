const dotenv = require("dotenv")
const result = dotenv.config({ path: ".env.local" })
console.log("Dotenv result:", result)
console.log("DATABASE_URL:", process.env.DATABASE_URL)

export { }

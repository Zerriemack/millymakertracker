require("dotenv").config();
console.log("DATABASE_URL present:", Boolean(process.env.DATABASE_URL));
console.log("Starts with:", (process.env.DATABASE_URL || "").slice(0, 25));
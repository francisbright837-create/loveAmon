require("dotenv").config();
const mongoose = require("mongoose");

console.log("Attempting to connect to MongoDB...");
console.log("URI (masked):", process.env.MONGO_URI?.replace(/:[^:@]+@/, ':****@'));

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
})
  .then(async () => {
    console.log("✅ MongoDB connected successfully!");
    console.log("Database name:", mongoose.connection.name);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections found:", collections.map(c => c.name));

    await mongoose.disconnect();
    console.log("Disconnected cleanly.");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ MongoDB connection FAILED");
    console.error("Error message:", err.message);
    process.exit(1);
  });
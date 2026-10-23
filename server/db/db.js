import mongoose from "mongoose";

const dbUrl = process.env.ATLASDB_URL;

// Serverless platforms keep one process alive for many requests, so the
// connection is opened once and shared. A failed attempt is forgotten so the
// next request retries instead of reusing a rejected promise for the life of
// the instance.
let connectionPromise = null;

const connectToDatabase = async () => {
  if (!dbUrl) {
    throw new Error("ATLASDB_URL is not set");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      // Fail inside the platform's time budget instead of letting queries sit
      // in Mongoose's buffer until they time out with no useful error.
      .connect(dbUrl, { serverSelectionTimeoutMS: 8000 })
      .then((connection) => {
        console.log("MongoDB Atlas connected successfully");
        console.log("Database:", connection.connection.name);
        console.log("Host:", connection.connection.host);

        return connection;
      })
      .catch((error) => {
        connectionPromise = null;

        console.error("MongoDB connection failed:", error.message);

        throw error;
      });
  }

  return connectionPromise;
};

export default connectToDatabase;
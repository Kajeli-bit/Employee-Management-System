import connectToDatabase from "./db.js";

export const createEnsureDatabase = (
  connect = connectToDatabase
) => async (req, res, next) => {
  try {
    await connect();
    return next();
  } catch (error) {
    console.error("Database unavailable for request:", error.message);

    return res.status(503).json({
      success: false,
      error: "Database temporarily unavailable. Please try again.",
      code: "DATABASE_UNAVAILABLE",
    });
  }
};

export default createEnsureDatabase();

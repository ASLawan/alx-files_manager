import mongoose from "mongoose";

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || "files_manager";

    // MongoDB connection string
    const mongoURI = `mongodb://${host}:${port}/${database}`;

    // Initialize the connection
    this.connected = false;
    this.connect(mongoURI);
  }

  async connect(mongoURI) {
    try {
      // Connecting to MongoDB using Mongoose
      await mongoose.connect(mongoURI);
      this.connected = true;
      console.log("Connected to MongoDB successfully");
    } catch (error) {
      this.connected = false;
      console.error("Error connecting to MongoDB:", error);
    }
  }

  // Returns true if the connection is alive, false otherwise
  isAlive() {
    return this.connected;
  }

  // Return the number of documents in the 'users' collection
  async nbUsers() {
    try {
      if (!this.isAlive()) {
        console.error("Not connected to MongoDB");
        return 0;
      }
      return await mongoose.connection.collection("users").countDocuments();
    } catch (error) {
      console.error("Error counting number of users:", error);
      return 0;
    }
  }

  // Return the number of documents in the 'files' collection
  async nbFiles() {
    try {
      if (!this.isAlive()) {
        console.error("Not connected to MongoDB");
        return 0;
      }
      return await mongoose.connection.collection("files").countDocuments();
    } catch (error) {
      console.error("Error counting number of files:", error);
      return 0;
    }
  }
}

// Exporting an instance of DBClient
const dbClient = new DBClient();
export default dbClient;

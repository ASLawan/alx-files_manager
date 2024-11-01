import redisClient from "../utils/redis.js";
import dbClient from "../utils/db.js";

class AppController {
  // GET /status
  static async getStatus(req, res) {
    const redisStatus = redisClient.isAlive();
    const dbStatus = dbClient.isAlive();

    res.status(200).json({
      redis: redisStatus,
      db: dbStatus,
    });
  }

  // GET /stats
  static async getStats(req, res) {
    try {
      const usersCount = await dbClient.nbUsers();
      const filesCount = await dbClient.nbFiles();

      res.status(200).json({
        users: usersCount,
        files: filesCount,
      });
    } catch (error) {
      console.error(`Error fetching stats: ${error.message}`);
      res
        .status(500)
        .json({ error: "An error occurred while fetching stats." });
    }
  }
}

export default AppController;

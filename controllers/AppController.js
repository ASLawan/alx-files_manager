import redisClient from '../utils/redis.js';
import dbClient from '../utils/db.js';

class AppController {
	static async getStatus(req, res){
		const redisAlive = redisClient.isAlive();
		const dbAlive = dbClient.isAlive()

		return res.status(200).json({redis: redisAlive, db: dbAlive});
	}

	static async getStats(req, res){
		try{
			const usersCount = await dbClient.nbUsers();
			const filesCount = await dbClient.nbFiles();

			return res.status(200).json({users: usersCount, files: filesCount})
		} catch(error){
			console.error('Error fetching stats:', error);
			return res.status(500).json({error: 'Failed to retrieve stats'})
		}
	}
}

export default AppController;


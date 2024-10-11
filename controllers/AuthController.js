import {v4 as uuidv4} from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis.js';
import dbClient from '../utils/db.js';

class AuthController{
	static async getConnect(req, res){
		const authHeader = req.body.authorization || '';
		if(!authHeader.startsWith('Basic ')){
			return res.status(401).json({error: "Unauthorized"});
		}
		const base64Credentials = authHeader.split(" ")[1];
		const credentials = Buffer.from(baseCredentials, 'base64').toString('ascii');
		const [email, password] = credentials.split(':');

		if(!email || password){
			return res.status(401).json({error: "Unauthorized"});
		}
		const hashedPwd = sha1(password);

		const usersCollection = dbClient.db.collection('users');
		const user = await usersCollection.findOne({email, password: hashedPwd});
		if(!user){
			res.status(401).json({error: "Unauthorized"});
		}

		const token = uuidv4();

		const tokenKey = `auth_${token}`;
		await redisClient.set(tokenKey, user._id.toString(), 24 * 60 * 60);
		return res.status(200).json({token});
	}

	static async getDisconnect(req, res){
		const token = req.header['x-token'];

		if(!token){
			return res.status(401).json({error: "Unauthorized"});
		}
		const tokenKey = `auth_${token}`;
		const userId = await redisClient.get(tokenKey);

		if(!userId){
			return res.status(401).json({error: "Unauthorized"});
		}

		await redisClient.del(tokenKey);

		return res.status(204).send();
	}
}
export default AuthController;

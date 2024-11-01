import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis'; // Ensure correct import
import dbClient from '../utils/db'; // Ensure correct import

class AuthController {
  static async getConnect(req, res) {
    // Use headers to get the Authorization field instead of req.body
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString(
      'ascii',
    );
    const [email, password] = credentials.split(':');

    // Check if email and password are present
    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hashedPwd = sha1(password);

    // Get users collection from the database
    const db = dbClient.client.db(dbClient.databaseName); // Correctly access the database
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email, password: hashedPwd });

    // If the user is not found, return Unauthorized
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate a new token
    const token = uuidv4();
    const tokenKey = `auth_${token}`;

    // Store the user ID in Redis with a 24-hour expiration
    await redisClient.set(tokenKey, user._id.toString(), 'EX', 86400); // Use 'EX' for expiration

    // Return the token
    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    // Use req.headers instead of req.header
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.get(tokenKey);

    // If user ID not found, return Unauthorized
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete the token from Redis
    await redisClient.del(tokenKey);

    // Return no content status
    return res.status(204).send();
  }
}

export default AuthController;

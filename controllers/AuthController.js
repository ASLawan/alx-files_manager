import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  /**
   *
   * @param {request} req
   * @param {response} res
   * @returns
   */
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;

    // Check if the auth header is present and properly formatted
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const encodedCredentials = authHeader.split(' ')[1];
    const decodedCredentials = Buffer.from(
      encodedCredentials,
      'base64',
    ).toString();
    const [email, password] = decodedCredentials.split(':');

    if (!email || !password) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const collection = dbClient.client.db().collection('users');
    const user = await collection.findOne({ email, password: sha1(password) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const key = `auth_${token}`;
    const expiresIn = 86400; // 24 hours in seconds

    // Set the token in Redis with a 24-hour expiration
    await redisClient.set(key, user._id.toString(), expiresIn);

    return res.status(200).json({ token });
  }

  /**
   *
   * @param {request} req
   * @param {response} res
   * @returns
   */
  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    // If no token is provided, consider it unauthorized
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    // If token is invalid or expired, clear it and respond with Unauthorized
    if (!userId) {
      await redisClient.del(key); // Ensure any lingering invalid token is cleared
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // If token is valid, delete it and log out user
    await redisClient.del(key);
    return res.status(204).send();
  }
}

export default AuthController;

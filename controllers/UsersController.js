import sha1 from 'sha1';
import dbClient from '../utils/db'; // Ensure the correct import
import redisClient from '../utils/redis'; // Ensure the correct import

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    // Check for missing email
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    // Check for missing password
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    // Access the users collection
    const usersCollection = dbClient.client
      .db(dbClient.databaseName)
      .collection('users'); // Ensure to use correct access
    try {
      // Check if the user already exists
      const userExists = await usersCollection.findOne({ email });
      if (userExists) {
        return res.status(400).json({ error: 'Already exist' }); // More descriptive error message
      }

      // Hash the password
      const hashedPwd = sha1(password);

      // Create a new user object
      const newUser = {
        email,
        password: hashedPwd,
      };

      // Insert the new user into the database
      const result = await usersCollection.insertOne(newUser);
      return res.status(201).json({ id: result.insertedId, email });
    } catch (error) {
      console.error('Error creating a new user:', error); // Log the actual error for debugging
      return res.status(500).json({ error: 'Failed to create a new user' });
    }
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.get(tokenKey);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const usersCollection = dbClient.client
      .db(dbClient.databaseName)
      .collection('users');
    const user = await usersCollection.findOne({
      _id: dbClient.ObjectID(userId),
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({ id: user._id, email: user.email });
  }
}

export default UsersController;

import sha1 from 'sha1';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    // Validate password
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const usersCollection = dbClient.client.db().collection('users');

    // Check if the email already exists in the database
    const userExists = await usersCollection.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'Already exist' });
    }

    // Hash the password using SHA1
    const hashedPassword = sha1(password);

    // Create new user object
    const newUser = {
      email,
      password: hashedPassword,
    };

    try {
      // Insert the new user into the database
      const result = await usersCollection.insertOne(newUser);
      // Return the new user with only id and email
      return res.status(201).json({ id: result.insertedId, email });
    } catch (error) {
      console.error('Error creating a new user:', error);
      return res.status(500).json({ error: 'Failed to create a new user' });
    }
  }
}

export default UsersController;

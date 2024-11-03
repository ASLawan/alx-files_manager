// import sha1 from 'sha1';
// import dbClient from '../utils/db';

// class UsersController {
//   static async postNew(req, res) {
//     const { email, password } = req.body;

//     // Validate email
//     if (!email) {
//       return res.status(400).json({ error: 'Missing email' });
//     }

//     // Validate password
//     if (!password) {
//       return res.status(400).json({ error: 'Missing password' });
//     }

//     const usersCollection = dbClient.client.db().collection('users');

//     // Check if the email already exists in the database
//     const userExists = await usersCollection.findOne({ email });
//     if (userExists) {
//       return res.status(400).json({ error: 'Already exist' });
//     }

//     // Hash the password using SHA1
//     const hashedPassword = sha1(password);

//     // Create new user object
//     const newUser = {
//       email,
//       password: hashedPassword,
//     };

//     try {
//       // Insert the new user into the database
//       const result = await usersCollection.insertOne(newUser);
//       // Return the new user with only id and email
//       return res.status(201).json({ id: result.insertedId, email });
//     } catch (error) {
//       console.error('Error creating a new user:', error);
//       return res.status(500).json({ error: 'Failed to create a new user' });
//     }
//   }
// }

// export default UsersController;

import { createHash } from 'crypto';
// import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
// import redisClient from '../utils/redis';

/**
 * @class UsersController
 * @description This class handles all authorization related requests
 */
class UsersController {
  /**
   * @param {object} req
   * @param {object} res
   * @returns {object} user
   * @memberof UsersController
   * @description This method creates a new user
   */
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      res.status(400).send({
        error: 'Missing email',
      });
      return;
    }
    if (!password) {
      res.status(400).send({
        error: 'Missing password',
      });
      return;
    }
    const users = dbClient.db.collection('users');

    // Check if user already exists
    const user = await users.findOne({
      email,
    });
    if (user) {
      res.status(400).send({
        error: 'Already exist',
      });
      return;
    }

    // Add new user
    const hash = createHash('sha1').update(password).digest('hex');
    const newUser = await users.insertOne({
      email,
      password: hash,
    });
    const json = {
      id: newUser.insertedId,
      email,
    };
    res.status(201).send(json);
  }
}

export default UsersController;

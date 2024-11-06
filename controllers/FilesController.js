import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    const tokenKey = `auth_${token}`;

    // Authenticate user based on token
    const userId = await redisClient.get(tokenKey);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract data from request body
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    // Validate input fields
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) return res.status(400).json({ error: 'Missing data' });

    const filesCollection = dbClient.getCollection('files');

    // Validate parentId if provided
    if (parentId !== 0) {
      const parentFile = await filesCollection.findOne({
        _id: dbClient.mongoClient.ObjectId(parentId),
      });
      if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    // Prepare file document to insert in MongoDB
    const fileDocument = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };

    // Handling file storage for non-folder types
    if (type === 'file' || type === 'image') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const localFileName = uuidv4();
      const localPath = path.join(folderPath, localFileName);

      // Decode Base64 data and save the file
      const fileContent = Buffer.from(data, 'base64');
      fs.writeFileSync(localPath, fileContent);

      fileDocument.localPath = localPath;
    }

    // Insert document in MongoDB and return it
    const result = await filesCollection.insertOne(fileDocument);
    return res.status(201).json({
      id: result.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
      localPath: fileDocument.localPath,
    });
  }
}

export default FilesController;

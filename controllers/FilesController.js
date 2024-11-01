import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    // Verify user authentication
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Validate required fields
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Validate parentId if specified
    const filesCollection = dbClient.client
      .db(dbClient.databaseName)
      .collection('files');
    if (parentId !== 0) {
      const parentFile = await filesCollection.findOne({
        _id: dbClient.ObjectID(parentId),
      });
      if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // Prepare file document data
    const newFile = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };

    // If folder, insert directly
    if (type === 'folder') {
      const result = await filesCollection.insertOne(newFile);
      return res.status(201).json({ id: result.insertedId, ...newFile });
    }

    // Set up the file storage path
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Generate local path and save the file
    const localPath = path.join(folderPath, uuidv4());
    const fileData = Buffer.from(data, 'base64');

    try {
      fs.writeFileSync(localPath, fileData);
      newFile.localPath = localPath;
      const result = await filesCollection.insertOne(newFile);
      return res.status(201).json({ id: result.insertedId, ...newFile });
    } catch (error) {
      console.error('Error saving file:', error);
      return res.status(500).json({ error: 'Failed to save file' });
    }
  }

  // GET /files/:id - Retrieve file by ID
  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const filesCollection = dbClient.client
      .db(dbClient.databaseName)
      .collection('files');

    try {
      const file = await filesCollection.findOne({
        _id: dbClient.ObjectID(id),
        userId,
      });

      if (!file) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(file);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /files - Retrieve user files with pagination
  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId || 0;
    const page = parseInt(req.query.page, 10) || 0;
    const limit = 20;
    const skip = page * limit;

    const filesCollection = dbClient.client
      .db(dbClient.databaseName)
      .collection('files');

    try {
      const files = await filesCollection
        .aggregate([
          {
            $match: {
              userId,
              parentId,
            },
          },
          {
            $skip: skip,
          },
          {
            $limit: limit,
          },
        ])
        .toArray();

      return res.status(200).json(files);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT /files/:id/publish - Set isPublic to true
  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const filesCollection = dbClient.client
      .db(dbClient.databaseName)
      .collection('files');

    try {
      const file = await filesCollection.findOneAndUpdate(
        { _id: dbClient.ObjectID(id), userId },
        { $set: { isPublic: true } },
        { returnOriginal: false },
      );

      if (!file.value) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(file.value);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT /files/:id/unpublish - Set isPublic to false
  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const filesCollection = dbClient.client
      .db(dbClient.databaseName)
      .collection('files');

    try {
      const file = await filesCollection.findOneAndUpdate(
        { _id: dbClient.ObjectID(id), userId },
        { $set: { isPublic: false } },
        { returnOriginal: false },
      );

      if (!file.value) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(file.value);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /files/:id/data - Retrieve the content of a file document by ID
  static async getFile(req, res) {
    const token = req.headers['x-token'];
    const { id } = req.params;

    const filesCollection = dbClient.client
      .db(dbClient.databaseName)
      .collection('files');
    const file = await filesCollection.findOne({ _id: dbClient.ObjectID(id) });

    if (!file) return res.status(404).json({ error: 'Not found' });

    // Check if the file is public or if the user is authenticated
    if (!file.isPublic) {
      const userId = token ? await redisClient.get(`auth_${token}`) : null;
      if (!userId || userId !== file.userId.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    // Check if the file type is a folder
    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    // Check if the file exists locally
    const { localPath } = file;
    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Get the MIME type based on the file name
    const mimeType = mime.lookup(file.name) || 'application/octet-stream';

    // Read and send the file content
    fs.readFile(localPath, (err, data) => {
      if (err) return res.status(500).json({ error: 'Error reading file' });
      res.setHeader('Content-Type', mimeType);
      return res.send(data);
    });
  }
}

export default FilesController;

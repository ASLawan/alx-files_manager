import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import redisClient from "../utils/redis.js";
import dbClient from "../utils/db.js";

const FOLDER_PATH = process.env.FOLDER_PATH || "/tmp/files_manager";

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers["x-token"];

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.get(tokenKey);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    // Validate request parameters
    if (!name) {
      return res.status(400).json({ error: "Missing name" });
    }

    if (!type || !["folder", "file", "image"].includes(type)) {
      return res.status(400).json({ error: "Missing type" });
    }

    if (type !== "folder" && !data) {
      return res.status(400).json({ error: "Missing data" });
    }

    // Check if parentId is provided and valid
    if (parentId !== 0) {
      const parentFile = await dbClient.db
        .collection("files")
        .findOne({ _id: dbClient.ObjectID(parentId) });

      if (!parentFile) {
        return res.status(400).json({ error: "Parent not found" });
      }

      if (parentFile.type !== "folder") {
        return res.status(400).json({ error: "Parent is not a folder" });
      }
    }

    const fileData = {
      userId: userId,
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : dbClient.ObjectID(parentId),
    };

    // Handle folder creation
    if (type === "folder") {
      const result = await dbClient.db.collection("files").insertOne(fileData);
      return res.status(201).json({
        id: result.insertedId,
        userId: userId,
        name,
        type,
        isPublic,
        parentId: parentId === 0 ? 0 : parentId,
      });
    }

    // Handle file or image upload
    const localFileName = uuidv4();
    const localFilePath = path.join(FOLDER_PATH, localFileName);

    // Ensure the directory exists
    if (!fs.existsSync(FOLDER_PATH)) {
      fs.mkdirSync(FOLDER_PATH, { recursive: true });
    }

    // Decode and write the Base64 data to the file
    const buffer = Buffer.from(data, "base64");
    fs.writeFileSync(localFilePath, buffer);

    // Save file metadata to the database
    fileData.localPath = localFilePath;
    const result = await dbClient.db.collection("files").insertOne(fileData);

    // Return the newly created file's metadata
    return res.status(201).json({
      id: result.insertedId,
      userId: userId,
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : parentId,
      localPath: localFilePath,
    });
  }

  // GET /files/:id: Retrieve a file document based on the ID
  static async getShow(req, res) {
    const token = req.headers["x-token"];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.get(tokenKey);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const fileId = req.params.id;
      const file = await dbClient.db
        .collection("files")
        .findOne({ _id: new ObjectId(fileId), userId });

      if (!file) {
        return res.status(404).json({ error: "Not found" });
      }

      return res.status(200).json(file);
    } catch (error) {
      console.error("Error fetching file by ID:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  // GET /files: Retrieve all user files for a specific parentId with pagination
  static async getIndex(req, res) {
    const token = req.headers["x-token"];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.get(tokenKey);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parentId = req.query.parentId ? new ObjectId(req.query.parentId) : 0;
    const page = parseInt(req.query.page, 10) || 0;
    const pageSize = 20;
    const skip = page * pageSize;

    try {
      const files = await dbClient.db
        .collection("files")
        .find({ userId, parentId })
        .skip(skip)
        .limit(pageSize)
        .toArray();

      return res.status(200).json(files);
    } catch (error) {
      console.error("Error fetching files list:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  // PUT /files/:id/publish: Set isPublic to true
  static async putPublish(req, res) {
    const token = req.headers["x-token"];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.get(tokenKey);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const fileId = req.params.id;
      const file = await dbClient.db
        .collection("files")
        .findOne({ _id: new ObjectId(fileId), userId });

      if (!file) {
        return res.status(404).json({ error: "Not found" });
      }

      await dbClient.db
        .collection("files")
        .updateOne(
          { _id: new ObjectId(fileId), userId },
          { $set: { isPublic: true } }
        );

      const updatedFile = await dbClient.db
        .collection("files")
        .findOne({ _id: new ObjectId(fileId), userId });
      return res.status(200).json(updatedFile);
    } catch (error) {
      console.error("Error publishing file:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  // PUT /files/:id/unpublish: Set isPublic to false
  static async putUnpublish(req, res) {
    const token = req.headers["x-token"];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tokenKey = `auth_${token}`;
    const userId = await redisClient.get(tokenKey);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const fileId = req.params.id;
      const file = await dbClient.db
        .collection("files")
        .findOne({ _id: new ObjectId(fileId), userId });

      if (!file) {
        return res.status(404).json({ error: "Not found" });
      }

      await dbClient.db
        .collection("files")
        .updateOne(
          { _id: new ObjectId(fileId), userId },
          { $set: { isPublic: false } }
        );

      const updatedFile = await dbClient.db
        .collection("files")
        .findOne({ _id: new ObjectId(fileId), userId });
      return res.status(200).json(updatedFile);
    } catch (error) {
      console.error("Error unpublishing file:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

export default FilesController;

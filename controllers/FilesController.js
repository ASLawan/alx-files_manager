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
}

export default FilesController;

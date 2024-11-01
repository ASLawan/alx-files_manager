#!/usr/bin/env node

import redis from "redis";

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on("error", (err) => {
      console.error("Redis client error:", err);
    });
  }

  isAlive() {
    if (this.client.connected) {
      return true;
    } else {
      return false;
    }
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, value) => {
        if (err) {
          reject(err);
        } else {
          resolve(value);
        }
      });
    });
  }

  async set(key, value, duration) {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, "EX", duration, (err, reply) => {
        if (err) {
          reject(err);
        } else {
          resolve(reply);
        }
      });
    });
  }

  async del(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err, reply) => {
        if (err) {
          reject(err);
        } else {
          resolve(reply);
        }
      });
    });
  }
}

const redisClient = new RedisClient();
export default redisClient;

// const redis = require('redis');
// const { promisify } = require('util');

// class RedisClient {
//   constructor() {
//     this.client = redis.createClient();
//     this.getAsync = promisify(this.client.get).bind(this.client);
//     this.client.on('error', (error) => {
//       console.log(`Redis client not connected to the server: ${error.message}`);
//     });
//   }

//   isAlive() {
//     return this.client.connected;
//   }

//   async get(key) {
//     return this.getAsync(key);
//   }

//   async set(key, value, duration) {
//     this.client.setex(key, duration, value);
//   }

//   async del(key) {
//     this.client.del(key);
//   }
// }

// const redisClient = new RedisClient();

// export default redisClient;

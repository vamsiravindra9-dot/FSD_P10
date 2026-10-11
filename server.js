const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5050;
const LOCAL_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'library';
const COLLECTION_NAME = 'books';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let client = null;
let db = null;

async function initMongo(uri = LOCAL_URI) {
  try {
    if (client) {
      await client.close().catch(() => {});
    }
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`Connected successfully to MongoDB at ${uri}`);
    return { success: true, uri };
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    return { success: false, error: err.message };
  }
}

// Server status and diagnostics
app.get('/api/status', async (req, res) => {
  try {
    if (!db) {
      await initMongo();
    }
    const admin = client.db().admin();
    const buildInfo = await admin.buildInfo();
    const serverStatus = await admin.serverStatus().catch(() => ({}));
    const collections = await db.listCollections().toArray();
    const booksCount = await db.collection(COLLECTION_NAME).countDocuments().catch(() => 0);

    res.json({
      connected: true,
      serverVersion: buildInfo.version || '8.2.1',
      host: serverStatus.host || 'localhost:27017',
      database: DB_NAME,
      collection: COLLECTION_NAME,
      collections: collections.map(c => c.name),
      documentCount: booksCount,
      localUri: LOCAL_URI
    });
  } catch (err) {
    res.status(500).json({
      connected: false,
      error: err.message,
      suggestion: 'Ensure MongoDB Windows service is running on localhost:27017'
    });
  }
});

// Get all books with optional filters
app.get('/api/books', async (req, res) => {
  try {
    const { author, genre, year, search } = req.query;
    const filter = {};

    if (author) filter.author = new RegExp(author, 'i');
    if (genre) filter.genre = new RegExp(genre, 'i');
    if (year) filter.year = Number(year);
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { author: new RegExp(search, 'i') },
        { genre: new RegExp(search, 'i') }
      ];
    }

    const books = await db.collection(COLLECTION_NAME).find(filter).toArray();
    res.json({ success: true, count: books.length, data: books });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Insert single or multiple books
app.post('/api/books', async (req, res) => {
  try {
    const { items, title, author, year, genre } = req.body;
    const collection = db.collection(COLLECTION_NAME);

    if (Array.isArray(items) && items.length > 0) {
      const sanitized = items.map(b => ({
        title: b.title,
        author: b.author,
        year: Number(b.year),
        genre: b.genre,
        createdAt: new Date()
      }));
      const result = await collection.insertMany(sanitized);
      return res.json({
        success: true,
        type: 'insertMany',
        mongoshCommand: `db.books.insertMany(${JSON.stringify(items, null, 2)})`,
        result
      });
    }

    if (!title || !author) {
      return res.status(400).json({ error: 'Title and author are required' });
    }

    const newDoc = {
      title,
      author,
      year: Number(year) || new Date().getFullYear(),
      genre: genre || 'General',
      createdAt: new Date()
    };
    const result = await collection.insertOne(newDoc);
    res.json({
      success: true,
      type: 'insertOne',
      mongoshCommand: `db.books.insertOne(${JSON.stringify(newDoc, null, 2)})`,
      result,
      document: newDoc
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update book by ID or title
app.put('/api/books/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { year, genre, title, author } = req.body;
    const collection = db.collection(COLLECTION_NAME);

    const updateFields = {};
    if (year !== undefined) updateFields.year = Number(year);
    if (genre !== undefined) updateFields.genre = genre;
    if (title !== undefined) updateFields.title = title;
    if (author !== undefined) updateFields.author = author;

    let query = {};
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { title: id };
    }

    const result = await collection.updateOne(query, { $set: updateFields });
    res.json({
      success: true,
      mongoshCommand: `db.books.updateOne(${JSON.stringify(query)}, { $set: ${JSON.stringify(updateFields)} })`,
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete book by ID or title
app.delete('/api/books/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const collection = db.collection(COLLECTION_NAME);

    let query = {};
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { title: id };
    }

    const result = await collection.deleteOne(query);
    res.json({
      success: true,
      mongoshCommand: `db.books.deleteOne(${JSON.stringify(query)})`,
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset Lab data to experiment default state
app.post('/api/reset-lab', async (req, res) => {
  try {
    const collection = db.collection(COLLECTION_NAME);
    await collection.deleteMany({});

    const initialDocs = [
      { title: "To Kill a Mockingbird", author: "Harper Lee", year: 1960, genre: "Fiction" },
      { title: "1984", author: "George Orwell", year: 1949, genre: "Dystopian" },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald", year: 1925, genre: "Classic" }
    ];

    const insertResult = await collection.insertMany(initialDocs);
    const books = await collection.find({}).toArray();

    res.json({
      success: true,
      message: 'Database reset to initial 3 experiment documents',
      insertedCount: insertResult.insertedCount,
      books
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Execute mongosh code or full experiment runner
app.post('/api/run-mongosh', (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Command code is required' });
  }

  // Escape double quotes for shell execution
  const cleanCode = code.replace(/"/g, '\\"');
  const command = `mongosh "mongodb://127.0.0.1:27017/library" --eval "${cleanCode}"`;

  exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
    res.json({
      success: !error,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      error: error ? error.message : null
    });
  });
});

// Test Atlas connection string
app.post('/api/test-atlas', async (req, res) => {
  const { uri } = req.body;
  if (!uri) {
    return res.status(400).json({ error: 'Atlas connection string is required' });
  }

  let testClient = null;
  try {
    testClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await testClient.connect();
    const admin = testClient.db().admin();
    const buildInfo = await admin.buildInfo();
    const dbs = await admin.listDatabases();

    await testClient.close();
    res.json({
      success: true,
      message: 'Successfully connected to MongoDB Atlas cluster!',
      version: buildInfo.version,
      databases: dbs.databases.map(d => d.name)
    });
  } catch (err) {
    if (testClient) await testClient.close().catch(() => {});
    res.status(400).json({
      success: false,
      message: 'Failed to connect to MongoDB Atlas cluster',
      error: err.message,
      troubleshooting: [
        'Check if your IP address is whitelisted in Atlas Network Access (0.0.0.0/0 for testing)',
        'Check your database username and password in the connection string',
        'Ensure the user has readWrite permissions to the database'
      ]
    });
  }
});

// Start Express server and connect to MongoDB
initMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`MongoDB Lab Experiment Server running at http://localhost:${PORT}`);
  });
});

// Switch to the 'library' database
db = db.getSiblingDB("library");

// Clear existing books collection for a clean experiment run
db.books.drop();

console.log("=== Step 1 & 2: Insert Documents (Create) ===");
const insertResult = db.books.insertMany([
  { title: "To Kill a Mockingbird", author: "Harper Lee", year: 1960, genre: "Fiction" },
  { title: "1984", author: "George Orwell", year: 1949, genre: "Dystopian" },
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald", year: 1925, genre: "Classic" }
]);
console.log("Insert Result:", insertResult);

console.log("\n=== Step 3: Read Documents (Find All Books) ===");
const allBooks = db.books.find().toArray();
console.log("All Books:", JSON.stringify(allBooks, null, 2));

console.log("\n=== Step 3 (cont): Find Books by Author 'George Orwell' ===");
const orwellBooks = db.books.find({ author: "George Orwell" }).toArray();
console.log("Books by George Orwell:", JSON.stringify(orwellBooks, null, 2));

console.log("\n=== Step 4: Update the Year of a Book ===");
const updateResult = db.books.updateOne(
  { title: "1984" },
  { $set: { year: 1950, genre: "Dystopian Fiction" } }
);
console.log("Update Result:", updateResult);

console.log("\n=== Step 5: Delete a Book by Title ===");
const deleteResult = db.books.deleteOne({ title: "The Great Gatsby" });
console.log("Delete Result:", deleteResult);

console.log("\n=== Step 6: Verify Final Collection State ===");
const finalBooks = db.books.find().toArray();
console.log("Final Books in Collection:", JSON.stringify(finalBooks, null, 2));

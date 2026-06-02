import Database from 'better-sqlite3';
const db = new Database('./sqlite.db');
const sponsors = db.prepare('SELECT * FROM sponsors').all();
console.log("Sponsors in DB:", sponsors.length);

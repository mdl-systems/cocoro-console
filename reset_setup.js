const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '.cocoro', 'cocoro.db'));
db.prepare("DELETE FROM user_settings WHERE key = 'setup_completed'").run();
const row = db.prepare("SELECT * FROM user_settings WHERE key = 'setup_completed'").get();
console.log(row ? 'STILL EXISTS' : 'CLEARED OK');
db.close();

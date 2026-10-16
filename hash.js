const bcrypt = require('bcryptjs');
const password = process.argv[2];
if (!password) {
  console.log('用法：npm run hash -- 你的密碼');
  process.exit(1);
}
console.log('將呢個 hash 貼入 Excel Rooms.password_hash：');
console.log(bcrypt.hashSync(password, 12));

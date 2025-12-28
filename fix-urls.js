// Quick script to replace localhost URLs with config
import fs from 'fs';
import path from 'path';

const files = [
  'chatapp/src/links/ChatDashbord.jsx',
  'chatapp/src/links/PrivateChatDashbord.jsx',
  'chatapp/src/links/Profile.jsx',
  'chatapp/src/links/GroupInfo.jsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace API URLs
  content = content.replace(/http:\/\/localhost:5000/g, '${config.API_URL}');
  
  // Replace socket URLs
  content = content.replace(/io\("http:\/\/localhost:5000"/g, 'io(config.SOCKET_URL');
  
  // Add config import if not present
  if (!content.includes('import config from')) {
    const lines = content.split('\n');
    const importIndex = lines.findIndex(line => line.includes('import'));
    if (importIndex !== -1) {
      lines.splice(importIndex + 1, 0, 'import config from "../config.js";');
      content = lines.join('\n');
    }
  }
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});

console.log('All URLs updated!');
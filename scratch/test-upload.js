const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

async function testUpload() {
  const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
  const prisma = new PrismaClient({ adapter });

  const user = await prisma.user.findUnique({ where: { username: 'doctor1' } });
  if (!user) {
    console.error('doctor1 not found');
    return;
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: 'Doctor' },
    'hosply_super_secret_jwt_key_2026_clinical_collaboration'
  );

  const formData = new FormData();
  formData.append('file', new Blob(['test content']), 'test.txt');
  formData.append('roomId', 'some-room-id');

  try {
    const res = await fetch('http://localhost:3006/api/storage/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testUpload();

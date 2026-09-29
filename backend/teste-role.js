require('dotenv').config();

const prisma = require('./src/config/prisma');

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
    },
  });

  console.log(users);
  await prisma.$disconnect();
}

main();
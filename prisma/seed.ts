// Fichier seed pour Prisma
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Démarrage du seed...');

  const users = [
    {
      name: 'Admin Hysacam',
      email: 'admin@hysacam.cm',
      password: 'Admin@1234',
      role: 'admin',
      status: 'ACTIVE',
    },
    {
      name: 'Agent Hysacam',
      email: 'agent@hysacam.cm',
      password: 'Agent@1234',
      role: 'agent',
      status: 'ACTIVE',
    },
    {
      name: 'Citoyen Hysacam',
      email: 'citizen@hysacam.cm',
      password: 'Citizen@1234',
      role: 'citizen',
      status: 'ACTIVE',
    },
  ];

  for (const userData of users) {
    const existing = await prisma.user.findUnique({ where: { email: userData.email } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(userData.password, 10);
      await prisma.user.create({
        data: {
          name: userData.name,
          email: userData.email,
          password: passwordHash,
          phone: null,
          role: userData.role,
          status: userData.status,
        },
      });
      console.log(`Création de l'utilisateur ${userData.email}`);
    } else {
      console.log(`Utilisateur déjà existant : ${userData.email}`);
    }
  }

  console.log('✅ Seed terminé');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

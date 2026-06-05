// Fichier stub pour Prisma seed (à compléter)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Démarrage du seed...');
  
  // TODO: Ajouter les données de seed
  
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

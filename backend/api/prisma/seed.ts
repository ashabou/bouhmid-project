import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const passwordHash = await bcrypt.hash('Admin@123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@shabouautopieces.tn' },
    update: {},
    create: {
      email: 'admin@shabouautopieces.tn',
      passwordHash,
      fullName: 'Admin User',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // Create brands
  const brands = await Promise.all([
    prisma.brand.upsert({
      where: { slug: 'bosch' },
      update: {},
      create: {
        name: 'Bosch',
        slug: 'bosch',
        countryOfOrigin: 'Germany',
        description: 'Leading manufacturer of automotive parts and technology',
        isActive: true,
      },
    }),
    prisma.brand.upsert({
      where: { slug: 'valeo' },
      update: {},
      create: {
        name: 'Valeo',
        slug: 'valeo',
        countryOfOrigin: 'France',
        description: 'French automotive supplier and partner to automakers',
        isActive: true,
      },
    }),
    prisma.brand.upsert({
      where: { slug: 'brembo' },
      update: {},
      create: {
        name: 'Brembo',
        slug: 'brembo',
        countryOfOrigin: 'Italy',
        description: 'World leader in braking systems',
        isActive: true,
      },
    }),
    prisma.brand.upsert({
      where: { slug: 'mann-hummel' },
      update: {},
      create: {
        name: 'Mann+Hummel',
        slug: 'mann-hummel',
        countryOfOrigin: 'Germany',
        description: 'Specialist in filtration solutions',
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${brands.length} brands`);

  // Create top-level categories
  const freinage = await prisma.category.upsert({
    where: { slug: 'freinage' },
    update: {},
    create: {
      name: 'Freinage',
      slug: 'freinage',
      level: 0,
      description: 'Système de freinage complet',
      isActive: true,
    },
  });

  const filtration = await prisma.category.upsert({
    where: { slug: 'filtration' },
    update: {},
    create: {
      name: 'Filtration',
      slug: 'filtration',
      level: 0,
      description: 'Filtres pour votre véhicule',
      isActive: true,
    },
  });

  const electrique = await prisma.category.upsert({
    where: { slug: 'electrique' },
    update: {},
    create: {
      name: 'Électrique',
      slug: 'electrique',
      level: 0,
      description: 'Composants électriques et électroniques',
      isActive: true,
    },
  });

  console.log('✅ Created top-level categories');

  // Create sub-categories
  await prisma.category.upsert({
    where: { slug: 'plaquettes-frein' },
    update: {},
    create: {
      name: 'Plaquettes de frein',
      slug: 'plaquettes-frein',
      parentId: freinage.id,
      level: 1,
      isActive: true,
    },
  });

  await prisma.category.upsert({
    where: { slug: 'disques-frein' },
    update: {},
    create: {
      name: 'Disques de frein',
      slug: 'disques-frein',
      parentId: freinage.id,
      level: 1,
      isActive: true,
    },
  });

  await prisma.category.upsert({
    where: { slug: 'filtres-huile' },
    update: {},
    create: {
      name: 'Filtres à huile',
      slug: 'filtres-huile',
      parentId: filtration.id,
      level: 1,
      isActive: true,
    },
  });

  await prisma.category.upsert({
    where: { slug: 'filtres-air' },
    update: {},
    create: {
      name: 'Filtres à air',
      slug: 'filtres-air',
      parentId: filtration.id,
      level: 1,
      isActive: true,
    },
  });

  console.log('✅ Created sub-categories');

  // Create sample products
  const plaquettesCategory = await prisma.category.findUnique({
    where: { slug: 'plaquettes-frein' },
  });

  const boschBrand = await prisma.brand.findUnique({
    where: { slug: 'bosch' },
  });

  if (plaquettesCategory && boschBrand) {
    await prisma.product.upsert({
      where: { sku: 'BOSCH-PLQ-001' },
      update: {},
      create: {
        sku: 'BOSCH-PLQ-001',
        name: 'Plaquettes de frein avant Bosch',
        slug: 'plaquettes-frein-avant-bosch',
        brandId: boschBrand.id,
        categoryId: plaquettesCategory.id,
        description: 'Plaquettes de frein avant haute qualité Bosch pour une performance de freinage optimale.',
        currentPrice: 89.90,
        originalPrice: 99.90,
        currency: 'TND',
        inStock: true,
        stockQuantity: 25,
        status: 'ACTIVE',
        specifications: {
          material: 'Céramique',
          garantie: '2 ans',
          compatibilité: 'Renault, Peugeot, Citroën',
        },
        compatibleVehicles: {
          brands: ['Renault', 'Peugeot', 'Citroën'],
          models: ['Clio', 'Megane', '208', '308', 'C3', 'C4'],
        },
        partNumber: 'BP1234',
      },
    });

    console.log('✅ Created sample product');
  }

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

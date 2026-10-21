import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();

const CATEGORIES = [
  'Nursing Foundations',
  'Community Health',
  'Medical-Surgical',
  'Pharmacology',
  'Anatomy & Physiology',
  'Paramedical Sciences',
  'Mental Health Nursing',
] as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const AUTHORS = [
  { slug: 'meera-chandrasekaran', name: 'Dr. Meera Chandrasekaran', credentials: 'PhD (Nursing), RN — Professor of Nursing Foundations', bio: 'Dr. Chandrasekaran has taught undergraduate nursing for over two decades and chairs the curriculum committee at a leading nursing college.' },
  { slug: 'daniel-fernandes', name: 'Prof. Daniel Fernandes', credentials: 'MSc (Community Health), RN — Public Health Nursing Faculty', bio: 'A former district health program officer, Prof. Fernandes brings field experience from public-health campaigns into every chapter he writes.' },
  { slug: 'ananya-rao', name: 'Dr. Ananya Rao', credentials: 'MD (Medicine) — Consultant Physician & Nursing Educator', bio: 'Dr. Rao co-authors the Medical-Surgical Nursing series, translating bedside clinical experience into structured learning material.' },
  { slug: 'thomas-varghese', name: 'Dr. Thomas Varghese', credentials: 'MD (Pathology) — Professor of Pathophysiology', bio: 'Dr. Varghese specialises in making disease mechanisms accessible to early-stage learners without oversimplifying the science.' },
  { slug: 'shalini-mehta', name: 'Dr. Shalini Mehta', credentials: 'PharmD — Clinical Pharmacology Faculty', bio: 'Dr. Mehta designs pharmacology curricula with a strong emphasis on medication-safety habits.' },
  { slug: 'rajiv-khanna', name: 'Dr. Rajiv Khanna', credentials: 'PhD (Anatomy) — Professor of Anatomy & Physiology', bio: 'Dr. Khanna has illustrated and written anatomy material for over fifteen years, focused on clinical correlation.' },
  { slug: 'leela-nair', name: 'Dr. Leela Nair', credentials: 'PhD (Psychiatric Nursing) — Mental Health Nursing Faculty', bio: 'Dr. Nair advocates for stigma-aware, person-centred mental health curricula.' },
  { slug: 'priya-subramaniam', name: 'Dr. Priya Subramaniam', credentials: 'MD (Obstetrics) — Maternal Health Faculty', bio: 'Dr. Subramaniam teaches maternal and newborn nursing with a family-centred-care approach.' },
];

const BOOKS = [
  { slug: 'foundations-of-nursing-practice', title: 'Foundations of Nursing Practice', subtitle: 'Principles, Skills and Clinical Reasoning', authors: ['meera-chandrasekaran'], category: 'Nursing Foundations', price: 895, edition: '4th Edition', format: 'PAPERBACK', isbn: '978-93-5522-101-4', pages: 612, stockQuantity: 40, description: 'A comprehensive entry point for undergraduate nursing students, covering core procedures, documentation standards and clinical-reasoning habits.', highlights: ['Procedure checklists aligned with current INC curriculum', 'Over 180 labelled clinical illustrations', 'Chapter-end case studies and self-assessment questions'], coverPalette: 'pine', featured: true },
  { slug: 'community-health-nursing-essentials', title: 'Community Health Nursing: Essentials for Practice', authors: ['daniel-fernandes'], category: 'Community Health', price: 775, edition: '3rd Edition', format: 'PAPERBACK', isbn: '978-93-5522-118-2', pages: 548, stockQuantity: 35, description: 'Explores public-health nursing roles, epidemiology fundamentals and field-level program delivery.', highlights: ['National health program summaries', 'Field-visit planning templates', 'Review questions mapped to board exam patterns'], coverPalette: 'amber', featured: true },
  { slug: 'medical-surgical-nursing-volume-one', title: 'Medical-Surgical Nursing — Volume I', subtitle: 'Adult Health Across Body Systems', authors: ['ananya-rao', 'thomas-varghese'], category: 'Medical-Surgical', price: 1150, edition: '5th Edition', format: 'HARDBOUND', isbn: '978-93-5522-132-8', pages: 820, stockQuantity: 25, description: 'A systems-based reference covering assessment, pathophysiology and nursing management.', highlights: ['Organized by body system for fast reference', 'Nursing care plans for common diagnoses', 'Companion volume available for critical care'], coverPalette: 'slate', featured: true, newRelease: true },
  { slug: 'medical-surgical-nursing-volume-two', title: 'Medical-Surgical Nursing — Volume II', subtitle: 'Perioperative and Critical Care', authors: ['ananya-rao', 'thomas-varghese'], category: 'Medical-Surgical', price: 1150, edition: '5th Edition', format: 'HARDBOUND', isbn: '978-93-5522-133-5', pages: 764, stockQuantity: 20, description: 'Continues Volume I with a focus on surgical preparation, intraoperative care and critical-care monitoring.', highlights: ['Step-by-step perioperative protocols', 'Critical-care monitoring parameters at a glance', 'Emergency response quick-reference appendix'], coverPalette: 'slate', newRelease: true },
  { slug: 'applied-pharmacology-for-nurses', title: 'Applied Pharmacology for Nurses', authors: ['shalini-mehta'], category: 'Pharmacology', price: 695, edition: '2nd Edition', format: 'PAPERBACK', isbn: '978-93-5522-145-8', pages: 436, stockQuantity: 50, description: 'Drug classifications, mechanisms and safe administration practices for everyday nursing shifts.', highlights: ['Dosage-calculation practice sets with worked answers', 'High-alert medication safety call-outs', 'Cross-referenced with common clinical protocols'], coverPalette: 'clay' },
  { slug: 'anatomy-physiology-allied-health', title: 'Anatomy & Physiology for Allied Health', authors: ['rajiv-khanna'], category: 'Anatomy & Physiology', price: 850, edition: '3rd Edition', format: 'PAPERBACK', isbn: '978-93-5522-150-2', pages: 592, stockQuantity: 30, description: 'Builds a working command of human structure and function for nursing and paramedical learners.', highlights: ['Full-colour diagrams with layered labelling', '"Clinical Correlation" boxes connect theory to practice', 'Companion question bank available separately'], coverPalette: 'pine', featured: true },
  { slug: 'paramedical-sciences-first-responder', title: 'Paramedical Sciences: The First-Responder Handbook', authors: ['rajiv-khanna'], category: 'Paramedical Sciences', price: 720, edition: '1st Edition', format: 'PAPERBACK', isbn: '978-93-5522-161-8', pages: 388, stockQuantity: 0, availability: 'PRE_ORDER', description: 'A field-oriented guide to emergency assessment and stabilisation for paramedical students.', highlights: ['Scenario-based triage walkthroughs', 'Equipment checklists for common response types', 'Quick-reference vitals and dosage tables'], coverPalette: 'amber', newRelease: true },
  { slug: 'mental-health-nursing-in-practice', title: 'Mental Health Nursing in Practice', authors: ['leela-nair'], category: 'Mental Health Nursing', price: 810, edition: '2nd Edition', format: 'PAPERBACK', isbn: '978-93-5522-172-4', pages: 456, stockQuantity: 28, description: 'Covers psychiatric assessment, therapeutic communication and stigma-aware care planning.', highlights: ['Therapeutic-communication scripts and pitfalls', 'Care plans aligned to common diagnostic categories', 'Reflective-practice prompts in every chapter'], coverPalette: 'clay' },
  { slug: 'nursing-research-and-biostatistics', title: 'Nursing Research and Biostatistics Made Simple', authors: ['meera-chandrasekaran'], category: 'Nursing Foundations', price: 640, edition: '2nd Edition', format: 'PAPERBACK', isbn: '978-93-5522-183-0', pages: 312, stockQuantity: 33, description: 'Demystifies research design and statistical reasoning for nursing programs.', highlights: ['Worked statistical examples using nursing scenarios', 'Guidance on writing a dissertation proposal', 'Glossary of commonly confused research terms'], coverPalette: 'pine' },
  { slug: 'fundamentals-of-pathophysiology', title: 'Fundamentals of Pathophysiology for Nursing', authors: ['thomas-varghese'], category: 'Anatomy & Physiology', price: 760, edition: '1st Edition', format: 'EBOOK', isbn: '978-93-5522-190-8', pages: 420, stockQuantity: 999, description: 'Explains disease mechanisms in plain language, bridging physiology and medical-surgical coursework.', highlights: ['Disease-process flow diagrams', 'Links each chapter to related medical-surgical topics', 'Downloadable summary sheets for revision'], coverPalette: 'slate' },
  { slug: 'maternal-newborn-nursing-care', title: 'Maternal and Newborn Nursing Care', authors: ['priya-subramaniam'], category: 'Community Health', price: 830, edition: '3rd Edition', format: 'PAPERBACK', isbn: '978-93-5522-204-2', pages: 540, stockQuantity: 0, availability: 'OUT_OF_STOCK', description: 'Antenatal through postnatal care, newborn assessment and family-centred practice.', highlights: ['Partograph and newborn-assessment walkthroughs', 'Family-counselling scripts for common concerns', 'Updated to current maternal-health guidelines'], coverPalette: 'amber' },
  { slug: 'drug-dosage-calculation-workbook', title: 'Drug Dosage Calculation Workbook', authors: ['shalini-mehta'], category: 'Pharmacology', price: 410, edition: '2nd Edition', format: 'PAPERBACK', isbn: '978-93-5522-215-8', pages: 196, stockQuantity: 60, description: 'A focused practice workbook of graded dosage-calculation problems for self-paced mastery.', highlights: ['300+ graded practice problems with full solutions', 'Common-error call-outs beside each problem type', 'Compact format for quick revision'], coverPalette: 'clay' },
] as const;

const FAQS = [
  { topic: 'ORDERS', question: 'How do I know if a title is in stock before ordering?', answer: 'Every book page shows live availability — In Stock, Pre-Order or Out of Stock — just below the title.' },
  { topic: 'ORDERS', question: 'Can I order on behalf of a college or library?', answer: 'Yes — institutional buyers should use the Bulk Orders page so we can apply institutional pricing and coordinate delivery and invoicing directly.' },
  { topic: 'DELIVERY', question: 'Which regions do you currently deliver to?', answer: 'We currently ship across India through our courier partners. See the Shipping page for timelines by region.' },
  { topic: 'DELIVERY', question: 'How will I track my order once it has shipped?', answer: 'A tracking reference is added to your order details and emailed to you once dispatched.' },
  { topic: 'RETURNS', question: 'What is your return window for damaged or incorrect items?', answer: 'Damaged, defective or incorrectly shipped items can be reported within 7 days of delivery.' },
  { topic: 'SUBMISSIONS', question: 'What subjects are you currently acquiring manuscripts for?', answer: 'Nursing, paramedical sciences and allied-health subjects — see the Authors page for details.' },
  { topic: 'ACCOUNTS', question: 'Do I need an account to browse the catalogue?', answer: 'No — browsing and search are open to everyone. An account is only needed to check out, track orders or save a wishlist.' },
] as const;

async function main() {
  console.log('Seeding categories & authors...');
  const categoryBySlug = new Map<string, string>();
  for (const name of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, slug: slugify(name) },
    });
    categoryBySlug.set(name, category.id);
  }

  const authorBySlug = new Map<string, string>();
  for (const author of AUTHORS) {
    const created = await prisma.author.upsert({ where: { slug: author.slug }, update: {}, create: author });
    authorBySlug.set(author.slug, created.id);
  }

  console.log('Seeding books...');
  for (const book of BOOKS) {
    const { authors, category, price, ...rest } = book;
    const categoryId = categoryBySlug.get(category)!;
    const authorIds = authors.map((slug) => authorBySlug.get(slug)!);

    await prisma.book.upsert({
      where: { slug: book.slug },
      update: {},
      create: {
        ...rest,
        categoryId,
        priceMinor: Math.round(price * 100),
        authors: { create: authorIds.map((authorId) => ({ authorId })) },
      },
    });
  }

  console.log('Seeding FAQs...');
  for (const [index, faq] of FAQS.entries()) {
    await prisma.faq.upsert({
      where: { id: `seed-faq-${index}` },
      update: {},
      create: { id: `seed-faq-${index}`, ...faq, sortOrder: index },
    });
  }

  console.log('Seeding accounts...');
  await prisma.user.upsert({
    where: { email: 'admin@nightingalepress.example' },
    update: {},
    create: {
      email: 'admin@nightingalepress.example',
      name: 'Admin User',
      role: 'ADMIN',
      passwordHash: await hashPassword('Admin123!'),
    },
  });
  await prisma.user.upsert({
    where: { email: 'staff@nightingalepress.example' },
    update: {},
    create: {
      email: 'staff@nightingalepress.example',
      name: 'Staff User',
      role: 'STAFF',
      passwordHash: await hashPassword('Staff123!'),
    },
  });
  await prisma.user.upsert({
    where: { email: 'demo@nightingalepress.example' },
    update: {},
    create: {
      email: 'demo@nightingalepress.example',
      name: 'Demo Customer',
      role: 'CUSTOMER',
      passwordHash: await hashPassword('Demo1234!'),
    },
  });

  console.log('Seeding a sample promotion...');
  await prisma.promotion.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      description: '10% off your first order',
      discountType: 'PERCENT',
      discountValue: 10,
      isActive: true,
    },
  });

  console.log('Seed complete.');
  console.log('Login with: admin@nightingalepress.example / Admin123!  |  staff@nightingalepress.example / Staff123!  |  demo@nightingalepress.example / Demo1234!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

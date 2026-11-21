import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Tạo 3 role
  for (const name of ['STUDENT', 'INSTRUCTOR', 'ADMIN']) {
    await prisma.setting.upsert({
      where: { type_name: { type: 'ROLE', name } },
      update: {},
      create: { type: 'ROLE', name },
    });
  }

  // 2. Tạo vài danh mục mẫu
  for (const name of ['Backend', 'Frontend', 'Database', 'DevOps']) {
    await prisma.setting.upsert({
      where: { type_name: { type: 'CATEGORY', name } },
      update: {},
      create: { type: 'CATEGORY', name },
    });
  }

  // 3. Tạo tài khoản admin
  const adminRole = await prisma.setting.findFirstOrThrow({
    where: { type: 'ROLE', name: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { email: 'admin@programmize.local' },
    update: {},
    create: {
      email: 'admin@programmize.local',
      username: 'admin',
      fullName: 'System Admin',
      passwordHash: await bcrypt.hash('Admin@12345', 12),
      roleId: adminRole.id,
      emailVerified: true,
    },
  });


  // 4. Giảng viên mẫu
  const instructorRole = await prisma.setting.findFirstOrThrow({
    where: { type: 'ROLE', name: 'INSTRUCTOR' },
  });
  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@programmize.local' },
    update: {},
    create: {
      email: 'instructor@programmize.local',
      username: 'instructor01',
      fullName: 'Nguyễn Văn Giảng',
      bio: 'Giảng viên backend với nhiều năm kinh nghiệm.',
      passwordHash: await bcrypt.hash('Instructor@12345', 12),
      roleId: instructorRole.id,
      emailVerified: true,
    },
  });

  // 5. Khóa học mẫu (kèm chương và bài học)
  const cat = async (name: string) =>
    (await prisma.setting.findFirstOrThrow({ where: { type: 'CATEGORY', name } })).id;

  const samples = [
    {
      title: 'NestJS từ cơ bản đến nâng cao',
      description: 'Xây dựng REST API hoàn chỉnh với NestJS, Prisma và MySQL.',
      objectives: 'Hiểu kiến trúc module, xây dựng API có xác thực và phân quyền.',
      durationHours: 20,
      price: 500000,
      salePrice: 399000,
      isFeatured: true,
      categoryId: await cat('Backend'),
    },
    {
      title: 'React cho người mới bắt đầu',
      description: 'Làm quen component, state và hook qua các ví dụ thực tế.',
      objectives: 'Tự dựng được một ứng dụng React nhỏ hoàn chỉnh.',
      durationHours: 12,
      price: 0,
      isFeatured: true,
      categoryId: await cat('Frontend'),
    },
    {
      title: 'MySQL và thiết kế cơ sở dữ liệu',
      description: 'Từ chuẩn hóa dữ liệu đến tối ưu truy vấn với index.',
      objectives: 'Thiết kế được lược đồ 3NF và viết truy vấn hiệu quả.',
      durationHours: 15,
      price: 300000,
      categoryId: await cat('Database'),
    },
  ];

  for (const s of samples) {
    const exists = await prisma.course.findFirst({ where: { title: s.title } });
    if (exists) continue;
    await prisma.course.create({
      data: {
        ...s,
        instructorId: instructor.id,
        chapters: {
          create: [
            {
              title: 'Giới thiệu',
              position: 1,
              status: 'PUBLISHED',
              lessons: {
                create: [
                  { title: 'Bài 1: Tổng quan khóa học', type: 'VIDEO', resourceUrl: 'https://example.com/video-1', durationMin: 10, position: 1, isPreview: true, status: 'PUBLISHED' },
                  { title: 'Bài 2: Cài đặt môi trường', type: 'VIDEO', resourceUrl: 'https://example.com/video-2', durationMin: 15, position: 2, isPreview: false, status: 'PUBLISHED' },
                ],
              },
            },
            {
              title: 'Chương nháp (chưa xuất bản)',
              position: 2,
              status: 'DRAFT',
              lessons: {
                create: [
                  { title: 'Bài nháp', type: 'VIDEO', resourceUrl: 'https://example.com/draft', durationMin: 5, position: 1, status: 'DRAFT' },
                ],
              },
            },
          ],
        },
      },
    });
  }

  // 6. Lớp học mẫu
  const nestCourse = await prisma.course.findFirstOrThrow({
    where: { title: 'NestJS từ cơ bản đến nâng cao' },
  });
  if (!(await prisma.class.findFirst({ where: { title: 'Lớp NestJS khóa 01' } }))) {
    await prisma.class.create({
      data: {
        title: 'Lớp NestJS khóa 01',
        description: 'Lớp học trực tiếp, thực hành xây dựng API cùng giảng viên.',
        objectives: 'Hoàn thành một dự án backend hoàn chỉnh sau 2 tháng.',
        assessment: 'Bài tập hàng tuần và dự án cuối khóa.',
        schedule: 'Thứ 3 và thứ 5, 19:00 đến 21:00',
        totalHours: 30,
        price: 1500000,
        salePrice: 1200000,
        startDate: new Date('2026-12-15'),
        endDate: new Date('2027-02-15'),
        categoryId: await cat('Backend'),
        instructorId: instructor.id,
        syllabus: {
          create: [
            { sessionNo: 1, objective: 'Làm quen NestJS, module, controller, service.' },
            { sessionNo: 2, objective: 'Kết nối database với Prisma.' },
            { sessionNo: 3, objective: 'Xác thực JWT và phân quyền.' },
          ],
        },
        courses: { create: [{ courseId: nestCourse.id }] },
      },
    });
  }

  // 7. Bài viết mẫu (1 đã xuất bản, 1 nháp)
  const posts = [
    { title: 'Lộ trình học backend cho người mới', status: 'PUBLISHED' as const },
    { title: 'Bài nháp chưa công khai', status: 'DRAFT' as const },
  ];
  for (const p of posts) {
    if (await prisma.post.findFirst({ where: { title: p.title } })) continue;
    await prisma.post.create({
      data: {
        title: p.title,
        content: '<p>Nội dung bài viết mẫu.</p>',
        status: p.status,
        publishedAt: p.status === 'PUBLISHED' ? new Date() : null,
        authorId: instructor.id,
        categoryId: await cat('Backend'),
      },
    });

  };

  const reactCourse = await prisma.course.findFirstOrThrow({
    where: { title: 'React cho người mới bắt đầu' },
    include: { chapters: { where: { position: 1 } } }
  });
  const firstChapter = reactCourse.chapters[0];
  if (!(await prisma.quiz.findFirst({ where: { chapterId: firstChapter.id } }))) {
    await prisma.quiz.create({
      data: {
        chapterId: firstChapter.id,
        title: 'Kiem tra kien thuc',
        instructions: 'Chon dap an dung',
        status: 'PUBLISHED',
        questions: {
          create: [
            {
              content: 'React la gi',
              position: 1,
              answers: {
                create: [
                  { content: 'Thư viện JavaScript để xây dựng giao diện', isCorrect: true },
                  { content: 'Hệ quản trị cơ sở dữ liệu' },
                  { content: 'Một ngôn ngữ lập trình' },
                  { content: 'Một hệ điều hành' },
                ],
              },
            },
          ]
        }
      }
    })
  }
}

main().finally(() => prisma.$disconnect());
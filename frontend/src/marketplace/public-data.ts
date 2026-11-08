import reference from './reference-data.json';
import { jobs, type Job } from './data';

// Static display fixtures for the reference layout. No live recruitment API.
export const publicJobs: Job[] = reference.jobs.map((item, index) => {
  const category = /kế toán/i.test(item.title) ? 'Finance' : /thiết kế/i.test(item.title) ? 'Design' : /kinh doanh/i.test(item.title) ? 'Sales' : /giáo viên/i.test(item.title) ? 'Education' : /media/i.test(item.title) ? 'Marketing' : 'Operations';
  const salary = item.salary.match(/[\d.]+/g)?.map(Number) ?? [0];
  return {
    ...jobs[0], id: `ref-${index + 1}`, title: item.title,
    company: { id: `ref-company-${index + 1}`, name: item.company, logo: item.company.slice(0,2), logoImage: item.logo, industry: category, size: '100–500', location: item.location, description: item.company, openRoles: 1, verified: true },
    location: item.location, salaryMin: salary[0], salaryMax: salary[1] ?? salary[0], currency: item.salary.includes('USD') ? 'USD' : 'triệu',
    salaryLabel: item.salary, postedLabel: item.posted, postedDays: /giờ/.test(item.posted) ? 0 : Number(item.posted.match(/\d+/)?.[0] ?? 1),
    category, level: 'Mid-level', match: undefined, matchedSkills: [], missingSkills: [], skills: [],
    description: `Vị trí ${item.title} tại ${item.company}. Thông tin mẫu phục vụ xem trước giao diện tuyển dụng.`,
    responsibilities: ['Thực hiện công việc theo vị trí ứng tuyển.', 'Phối hợp cùng các bộ phận liên quan.'],
    requirements: ['Có kỹ năng phù hợp với vị trí ứng tuyển.'], benefits: ['Trao đổi khi phỏng vấn.'],
  };
});
export const allJobs = [...publicJobs, ...jobs];
export const careerResources = reference.articles;
export { reference };

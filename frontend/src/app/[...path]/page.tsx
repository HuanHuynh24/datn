import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarketplaceApp from '@/marketplace/App';
import { routes, resolveRoute } from '@/marketplace/routes';

interface PageProps {
  params: Promise<{ path: string[] }>;
}

export const dynamicParams = true;

export function generateStaticParams() {
  return Object.keys(routes)
    .filter((pathname) => pathname !== '/')
    .map((pathname) => ({ path: pathname.slice(1).split('/') }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { path } = await params;
  const route = resolveRoute(`/${path.join('/')}`);
  if (!route) return {};
  const titles: Record<string, string> = {
    'job-search': 'Tìm việc làm',
    'job-detail': 'Chi tiết việc làm',
    companies: 'Công ty',
    career: 'Phát triển sự nghiệp',
    signin: 'Đăng nhập',
    'signup-candidate': 'Đăng ký ứng viên',
    'signup-recruiter': 'Đăng ký nhà tuyển dụng',
    'candidate-home': 'Không gian ứng viên',
    'candidate-profile': 'Hồ sơ nghề nghiệp',
    'candidate-recommended': 'Việc làm phù hợp',
    'candidate-saved': 'Việc làm đã lưu',
    'candidate-applications': 'Việc đã ứng tuyển',
    'cv-upload': 'Quản lý CV',
    'recruiter-home': 'Không gian tuyển dụng',
    'recruiter-jobs': 'Tin tuyển dụng',
    'recruiter-create-job': 'Đăng tin tuyển dụng',
    'recruiter-applicants': 'Ứng viên',
    'recruiter-search': 'Tìm kiếm ứng viên',
    'recruiter-recommended': 'Ứng viên phù hợp',
    'recruiter-candidate': 'Hồ sơ ứng viên',
    'recruiter-pipeline': 'Quy trình tuyển dụng',
    'recruiter-company': 'Hồ sơ công ty',
  };
  return { title: titles[route.page] ?? 'Talentiq' };
}

export default async function MarketplacePage({ params }: PageProps) {
  const { path } = await params;
  const route = resolveRoute(`/${path.join('/')}`);
  if (!route) notFound();
  return <MarketplaceApp {...route} />;
}

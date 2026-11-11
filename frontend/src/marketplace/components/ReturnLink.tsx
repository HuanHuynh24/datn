import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { safeReturnPath } from '../routes';

export default function ReturnLink({ fallback, children }: { fallback: string; children: React.ReactNode }) {
  const params = useSearchParams();
  const href = safeReturnPath(params.get('returnTo'), fallback);
  const labels: Record<string, string> = {
    '/candidate': 'Quay lại tổng quan ứng viên',
    '/candidate/applications': 'Quay lại việc làm đã ứng tuyển',
    '/candidate/saved': 'Quay lại việc làm đã lưu',
    '/candidate/recommended': 'Quay lại khám phá việc làm',
    '/recruiter': 'Quay lại tổng quan tuyển dụng',
    '/recruiter/talent-search': 'Quay lại tìm kiếm nhân tài',
    '/recruiter/recommended': 'Quay lại ứng viên phù hợp',
    '/recruiter/pipeline': 'Quay lại quy trình tuyển dụng',
  };
  return <Link className="ui-return-link" href={href}>← {labels[href.split('?')[0]] ?? children}</Link>;
}

import Image from 'next/image';
import Link from 'next/link';
import Icon from './Icon';
import { safePublicUrl, type PublicCompany } from '../public-company-client';
export default function PublicCompanyCard({ company, returnTo }: { company: PublicCompany; returnTo?: string }) {
  const logo = safePublicUrl(company.logo_url);
  const href = '/companies/' + company.company_id + (returnTo ? '?' + new URLSearchParams({returnTo}) : '');
  return <article className="cl-company-card" data-company-id={company.company_id}>
    <div className="cl-company-cover" style={{ height: 130, background: 'var(--color-brand-light)', display: 'grid', placeItems: 'center', color: 'var(--color-brand)' }}><Icon name="building" /></div>
    <div className="cl-company-body"><div className="cl-company-logo">{logo ? <Image unoptimized src={logo} alt={company.company_name} width={70} height={70} /> : <span>{company.company_name.split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase()}</span>}</div><h3><Link href={href}>{company.company_name}</Link></h3><p>{company.industry || 'Chưa cập nhật lĩnh vực'}</p></div>
    <div className="cl-company-footer"><Link href={href}>{company.open_job_count} việc làm đang mở</Link><small><Icon name="pin" />{company.address || 'Chưa cập nhật địa chỉ'}</small></div>
  </article>;
}

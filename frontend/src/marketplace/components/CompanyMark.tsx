import type { Company } from '../data';
import Image from 'next/image';
import { useState } from 'react';

const colors: Record<string, string> = {
  c1: '#1767cb', c2: '#00887b', c3: '#ea632d', c4: '#7960bb', c5: '#1b4078', c6: '#e1a02d',
};

export default function CompanyMark({ company, className = '' }: { company: Company; className?: string }) {
  const [failed, setFailed] = useState<string>();
  if (company.logoImage && company.logoImage !== failed) return <span className={`company-image-mark ${className}`}><Image unoptimized src={company.logoImage} alt={company.name} width={96} height={96} onError={()=>setFailed(company.logoImage)} /></span>;
  return (
    <span aria-label={company.name} className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-border/70 bg-white font-extrabold tracking-tighter ${className}`} style={{ color: colors[company.id] ?? '#0069db' }}>
      <span className="border-b-[3px] border-current px-1 pb-0.5 leading-none">{company.logo}</span>
    </span>
  );
}

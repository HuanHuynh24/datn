import Image from 'next/image';
import type { ReactNode } from 'react';

const visuals = {
  candidate: { src: 'career-planning', alt: 'Chuẩn bị cho công việc bên laptop và sổ ghi chép', position: '55% 38%', heroPosition: '55% 8%' },
  career: { src: 'candidate-work', alt: 'Một ngày làm việc tại văn phòng', position: '38% 35%', heroPosition: '38% 3%' },
  recruiter: { src: 'team-collaboration', alt: 'Đồng nghiệp cùng trao đổi và làm việc trong văn phòng', position: '50% 40%', heroPosition: '50% 10%' },
  team: { src: 'team-meeting', alt: 'Đồng nghiệp trao đổi về dự án tại bàn làm việc', position: '65% 35%', heroPosition: '65% 12%' },
};

export type WorkspaceVisual = keyof typeof visuals;
export type WorkspaceHeroProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  visual: WorkspaceVisual;
  featured?: boolean;
  headingLevel?: 1 | 2;
};

export default function WorkspaceHero({ title, description, eyebrow, actions, visual, featured = false, headingLevel = 1 }: WorkspaceHeroProps) {
  const photo = visuals[visual];
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return <header className={`ui-workspace-hero ${featured ? 'ui-workspace-hero-featured' : ''}`} data-visual={visual}>
    <div className="ui-workspace-hero-inner">
      <div className="ui-workspace-hero-copy">
        {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
        <Heading>{title}</Heading>
        {description && <p className="ui-description">{description}</p>}
        {actions && <div className="ui-actions">{actions}</div>}
      </div>
    </div>
    <div className="ui-workspace-hero-photo">
      <Image src={`/images/workspace/${photo.src}.jpg`} alt={photo.alt} fill
        sizes="(max-width: 767px) 100vw, 60vw"
        loading="eager" fetchPriority="high" style={{ objectFit: 'cover', objectPosition: photo.heroPosition }} />
    </div>
  </header>;
}

export function WorkspacePhoto({ visual, className = '' }: { visual: WorkspaceVisual; className?: string }) {
  const photo = visuals[visual];
  return <div className={`ui-workspace-photo ${className}`}><Image src={`/images/workspace/${photo.src}.jpg`} alt={photo.alt} fill sizes="(max-width: 767px) 100vw, 320px" style={{ objectFit: 'cover', objectPosition: photo.position }} /></div>;
}

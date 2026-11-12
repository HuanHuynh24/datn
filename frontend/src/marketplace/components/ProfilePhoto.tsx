import Image from 'next/image';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuthSession } from '../auth-client';
import { ManagedImage } from './ImageUpload';

// Stock portraits illustrate fictional demo profiles; see public/images/workspace/sources.json.
const portraits: Record<string, { file: string; position: string; scale?: number; origin?: string }> = {
  ca1: { file: 'profile-minh-tuan', position: '50% 0%', scale: 1.7, origin: '55% 40%' },
  ca2: { file: 'profile-lan-anh-office', position: '40% 35%', scale: 1.6, origin: '40% 30%' },
  ca3: { file: 'profile-duc-khai', position: '100% 50%' },
  ca4: { file: 'profile-thu-huong', position: '70% 0%', scale: 1.7, origin: '55% 0%' },
  ca5: { file: 'profile-hoang-nam', position: '50% 28%' },
  extra1: { file: 'profile-thanh-long', position: '50% 20%', scale: 1.35, origin: '50% 30%' },
  self: { file: 'profile-alex', position: '50% 0%', scale: 1.7, origin: '50% 30%' },
};

export default function ProfilePhoto({ id, initials, large = false }: { id: string; initials: string; large?: boolean }) {
  const portrait = portraits[id];
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const profile = useAuthSession()?.profile;
  const style: CSSProperties | undefined = portrait ? {
    objectFit: 'cover', objectPosition: portrait.position,
    transform: portrait.scale ? `scale(${portrait.scale})` : undefined, transformOrigin: portrait.origin,
  } : undefined;
  if (id === 'self') return <span className={`ui-avatar ui-profile-photo ${large ? 'ui-avatar-large' : ''}`}><ManagedImage endpoint="/api/v1/candidates/me/avatar" url={profile?.avatar_url??null} alt="Ảnh đại diện của bạn" fallback={initials}/></span>;
  return <span className={`ui-avatar ui-profile-photo ${large ? 'ui-avatar-large' : ''}`}>
    {portrait && failedSource !== portrait.file ? <Image src={`/images/workspace/${portrait.file}.jpg`} alt="" width={large ? 152 : 104} height={large ? 152 : 104} style={style} onError={() => setFailedSource(portrait.file)} /> : initials}
  </span>;
}

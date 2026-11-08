import Link from 'next/link';
import Icon from './Icon';

export default function ProfileNavigation({ active }: { active: 'profile' | 'cvs' }) {
  return <nav className="ui-profile-navigation" aria-label="Hồ sơ và CV">
    <Link href="/candidate/profile" aria-current={active === 'profile' ? 'page' : undefined}><Icon name="user" /><span>Hồ sơ nghề nghiệp<small>Thông tin cá nhân và kinh nghiệm</small></span></Link>
    <Link href="/candidate/cvs" aria-current={active === 'cvs' ? 'page' : undefined}><Icon name="document" /><span>Quản lý CV<small>Tệp CV và bản dùng để ứng tuyển</small></span></Link>
  </nav>;
}

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { logout, useAuthSession } from '../auth-client';
import { getPageUrl } from '../routes';
import Brand from './Brand';
import Icon from './Icon';
import Dropdown from './Dropdown';
import Dialog from './Dialog';
import HeaderSearch from './HeaderSearch';
import { headerNavigation, isHeaderLinkActive, type HeaderLink, type NavMode } from './header-navigation';

interface NavProps { mode: NavMode; activePage: string; onNavigate: (page: string, data?: unknown) => void }

export default function Nav({ mode, activePage, onNavigate }: NavProps) {
  const session = useAuthSession();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const isGuest = mode === 'public';
  const isRecruiter = mode === 'recruiter';
  const homePage = isRecruiter ? 'recruiter-home' : isGuest ? 'home' : 'candidate-home';
  const role = isRecruiter ? 'Nhà tuyển dụng' : 'Ứng viên';
  const name = session?.profile?.full_name || session?.company?.company_name || (isRecruiter ? 'Tài khoản doanh nghiệp' : 'Tài khoản ứng viên');
  const initials = name.trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toLocaleUpperCase('vi');
  const items = headerNavigation[mode];
  const searchPage = activePage === 'job-search' || activePage === 'job-detail';
  const primary: HeaderLink = isGuest
    ? { page: 'signup-candidate', label: 'Đăng ký' }
    : isRecruiter ? { page: 'recruiter-create-job', label: 'Đăng tin' }
      : { page: 'cv-upload', label: 'Tải CV lên' };
  const accountLinks: HeaderLink[] = isRecruiter
    ? [{ page: 'recruiter-company', label: 'Hồ sơ công ty' }]
    : [{ page: 'candidate-profile', label: 'Hồ sơ nghề nghiệp' }];
  const mobileAccountLinks = accountLinks.filter(link => !items.some(item => item.page === link.page || item.children?.some(child => child.page === link.page)));
  const exploreLinks: HeaderLink[] = [
    ...(isRecruiter ? [{ page: 'home', label: 'Khám phá việc làm' }] : []),
    { page: 'companies', label: 'Khám phá công ty' },
    { page: 'career', label: 'Cẩm nang nghề nghiệp' },
  ];
  const switchLink: HeaderLink = isRecruiter
    ? { page: 'candidate-home', label: 'Dành cho ứng viên' }
    : { page: 'recruiter-home', label: 'Dành cho nhà tuyển dụng' };

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1200px)');
    const resize = () => { setMobileOpen(false); setOpenMenu(null); };
    desktop.addEventListener('change', resize);
    return () => desktop.removeEventListener('change', resize);
  }, []);

  const navigate = (page: string, data?: unknown) => {
    setOpenMenu(null);
    setMobileOpen(false);
    onNavigate(page, data);
  };
  const closeMobile = () => {
    setMobileOpen(false);
    requestAnimationFrame(() => menuTrigger.current?.focus());
  };
  const renderLink = (link: HeaderLink, className = 'site-menu-link') => (
    <Link key={link.page} href={getPageUrl(link.page)} className={className}
      aria-current={isHeaderLinkActive(link, activePage) ? 'page' : undefined}
      onNavigate={event => { event.preventDefault(); navigate(link.page); }}>{link.label}</Link>
  );
  const identity = <><span className="site-account-avatar" aria-hidden="true">{initials || <Icon name="user" />}</span><span className="site-account-copy"><strong title={name}>{name}</strong><small>{role}</small></span></>;

  return <>
    <header className="site-header" data-mode={mode}>
      <div className="site-header-inner">
        <Link className="site-logo" href={getPageUrl(homePage)} aria-label={`Talentiq — ${isGuest ? 'Trang chủ' : 'Tổng quan ' + role.toLocaleLowerCase('vi')}`}
          onNavigate={event => { event.preventDefault(); navigate(homePage); }}><Brand /></Link>
        <nav className="site-desktop-nav" aria-label="Điều hướng chính">
          {items.map(item => item.children ? <Dropdown key={item.page} className="site-nav-group" triggerClassName="site-nav-link" panelClassName="site-menu-panel"
            open={openMenu === item.page} onOpenChange={open => setOpenMenu(open ? item.page : null)}
            active={isHeaderLinkActive(item, activePage) || item.children.some(child => isHeaderLinkActive(child, activePage))}
            label={<>{item.label}<Icon name="down" /></>}>
            {item.children.map(child => renderLink(child))}
          </Dropdown> : renderLink(item, 'site-nav-link'))}
        </nav>
        <div className="site-header-actions">
          {isGuest ? <>
            {renderLink({ page: 'signin', label: 'Đăng nhập' }, 'site-signin')}
            {renderLink(primary, 'site-header-cta site-guest-signup')}
            {renderLink({ page: 'recruiter-home', label: 'Nhà tuyển dụng' }, 'site-employer-entry')}
          </> : <>
            <Dropdown className="site-account" triggerClassName="site-account-trigger" panelClassName="site-menu-panel site-account-panel" align="end"
              open={openMenu === 'account'} onOpenChange={open => setOpenMenu(open ? 'account' : null)}
              active={(isRecruiter && accountLinks.some(link => isHeaderLinkActive(link, activePage))) || exploreLinks.some(link => isHeaderLinkActive(link, activePage))}
              label={<>{identity}<Icon name="down" /></>}>
              <div className="site-menu-identity"><strong>{name}</strong><span>{role}</span></div>
              {accountLinks.map(link => renderLink(link))}
              <div className="site-menu-section">{exploreLinks.map(link => renderLink(link))}</div>
              <div className="site-menu-section">{renderLink(switchLink)}</div>
              <button className="site-menu-link" onClick={() => { logout(); navigate('signin'); }}>Đăng xuất</button>
            </Dropdown>
            {activePage !== primary.page && renderLink(primary, 'site-header-cta')}
          </>}
          <button ref={menuTrigger} type="button" className="site-menu-toggle" aria-label="Mở menu điều hướng" aria-haspopup="dialog"
            aria-expanded={mobileOpen} aria-controls={mobileOpen ? 'site-mobile-navigation' : undefined} onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
        </div>
      </div>
    </header>
    {searchPage && <div className="site-search-context"><Suspense fallback={<div className="site-search-placeholder" />}><HeaderSearch onNavigate={navigate} /></Suspense></div>}
    {mobileOpen && <Dialog title={isGuest ? 'Khám phá Talentiq' : 'Menu ' + role.toLocaleLowerCase('vi')} className="site-mobile-drawer" onClose={closeMobile}>
      {!isGuest && <div className="site-mobile-identity">{identity}</div>}
      <nav id="site-mobile-navigation" aria-label="Điều hướng trên thiết bị nhỏ">
        {items.map(item => item.children ? <section className="site-mobile-group" key={item.page}><h3>{item.label}</h3>{item.children.map(child => renderLink(child))}</section> : renderLink(item, 'site-menu-link site-mobile-top-link'))}
        {!isGuest && <section className="site-mobile-group"><h3>{isRecruiter ? 'Doanh nghiệp & cẩm nang' : 'Khám phá thêm'}</h3>{mobileAccountLinks.map(link => renderLink(link))}{exploreLinks.map(link => renderLink(link))}</section>}
      </nav>
      <div className="site-mobile-footer">
        {isGuest && <div className="site-mobile-auth">{renderLink({ page: 'signin', label: 'Đăng nhập' }, 'ui-btn')}{renderLink(primary, 'site-header-cta')}</div>}
        {renderLink(switchLink, 'site-role-switch')}
        {!isGuest && <button className="site-menu-link" onClick={() => { logout(); navigate('signin'); }}>Đăng xuất</button>}
      </div>
    </Dialog>}
  </>;
}

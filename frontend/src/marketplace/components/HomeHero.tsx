import { useId, useState } from 'react';
import Image from 'next/image';
import { reference } from '../public-data';
import type { Navigate } from '../ui';
import Icon from './Icon';

const employerSlides = [
  { image: 'team-collaboration', title: 'Tìm đúng người,', accent: 'cùng nhau phát triển.', description: 'Kết nối với ứng viên phù hợp cho vị trí bạn đang tuyển.', action: 'Đăng tin tuyển dụng', page: 'recruiter-create-job' },
  { image: 'team-meeting', title: 'Cơ hội mới bắt đầu', accent: 'từ một kết nối.', description: 'Khám phá hồ sơ, kinh nghiệm và kỹ năng của ứng viên.', action: 'Khám phá ứng viên', page: 'recruiter-search' },
];

/** The same search, banner sizing and carousel are used on all three homepages. */
export default function HomeHero({ onNavigate, employer = false }: { onNavigate: Navigate; employer?: boolean }) {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [banner, setBanner] = useState(0);
  const locationId = useId();
  const slide = employerSlides[banner];
  return <section className={`cl-banner-section ${employer ? 'cl-employer-banner-section' : ''}`} aria-label={employer ? 'Tìm kiếm ứng viên' : 'Tìm việc làm'}>
    <form className="cl-home-search cl-container" role="search" onSubmit={event => {
      event.preventDefault();
      onNavigate(employer ? 'recruiter-search' : 'job-search', { keyword, location });
    }}>
      <label className="cl-keyword"><Icon name="search" /><input value={keyword} onChange={event => setKeyword(event.target.value)} aria-label={employer ? 'Tên, vị trí hoặc kỹ năng ứng viên' : 'Vị trí, công ty hoặc từ khóa'} placeholder={employer ? 'Nhập tên ứng viên, vị trí, kỹ năng' : 'Nhập tên vị trí, công ty, từ khóa'} /><span className="cl-mobile-placeholder" aria-hidden="true">{!keyword && (employer ? 'Tìm ứng viên, vị trí, kỹ năng' : 'Bạn muốn tìm việc gì?')}</span></label>
      <label className="cl-location"><Icon name="pin" /><input value={location} onChange={event => setLocation(event.target.value)} aria-label="Tỉnh, thành phố" placeholder="Nhập tỉnh, thành phố" list={locationId} /><datalist id={locationId}>{['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Bình Dương', 'Đồng Nai'].map(city => <option key={city}>{city}</option>)}</datalist></label>
      <button className="cl-search-button" type="submit" aria-label="Tìm kiếm"><Icon name="search" /><span>Tìm kiếm</span></button>
    </form>
    <div className={`cl-banner ${employer ? 'cl-employer-banner' : ''}`} role="group" aria-roledescription="carousel" aria-label={employer ? 'Dịch vụ tuyển dụng' : 'Cơ hội nghề nghiệp'}>
      {employer ? <>
        <div className="cl-employer-banner-image"><Image src={`/images/workspace/${slide.image}.jpg`} alt="Đồng nghiệp cùng làm việc và trao đổi tại văn phòng" fill sizes="(max-width: 767px) 100vw, 55vw" preload style={{ objectFit: 'cover', objectPosition: '50% 30%' }} /></div>
        <div className="cl-container cl-employer-banner-content"><div className="cl-employer-banner-copy" aria-live="polite"><h2>{slide.title}<span>{slide.accent}</span></h2><p>{slide.description}</p><button className="cl-banner-cta" onClick={() => onNavigate(slide.page)}>{slide.action}<Icon name="right" /></button></div></div>
      </> : <>
        <Image unoptimized src={reference.banners[banner]} alt={banner === 0 ? 'CareerLink.vn nay đã có mặt trên Zalo OA' : 'Tìm việc làm trên ứng dụng CareerLink'} width={1600} height={440} preload />
        <button className="cl-banner-cta" onClick={() => onNavigate(banner === 0 ? 'career' : 'job-search')}>Tìm Hiểu Thêm</button>
      </>}
      <button className="cl-banner-prev" aria-label="Banner trước" onClick={() => setBanner(1 - banner)}><Icon name="right" /></button>
      <button className="cl-banner-next" aria-label="Banner tiếp theo" onClick={() => setBanner(1 - banner)}><Icon name="right" /></button>
      <div className="cl-banner-dots">{[0, 1].map(index => <button key={index} aria-label={`Banner ${index + 1}`} aria-pressed={banner === index} onClick={() => setBanner(index)} />)}</div>
    </div>
  </section>;
}


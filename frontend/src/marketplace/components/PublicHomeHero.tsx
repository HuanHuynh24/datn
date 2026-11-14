import {useState} from 'react';
import type {Navigate} from '../ui';
import Icon from './Icon';

export default function PublicHomeHero({onNavigate}:{onNavigate:Navigate}) {
  const [keyword,setKeyword]=useState('');const [location,setLocation]=useState('');
  return <section className="cl-banner-section actor-public-hero" aria-label="Tìm việc làm"><div className="cl-container">
    <div className="actor-public-hero-copy"><p className="actor-public-eyebrow">TALENTIQ · ĐỒNG HÀNH CÙNG SỰ NGHIỆP</p><h2>Cơ hội mới.<br/><span>Bước tiến của bạn.</span></h2><p>Tìm công việc phù hợp với kỹ năng và định hướng của bạn.</p></div><div className="actor-public-art" aria-hidden="true"><Icon name="briefcase"/><span><Icon name="check"/></span></div>
    <form className="cl-home-search" role="search" onSubmit={event=>{event.preventDefault();onNavigate('job-search',{keyword,location});}}>
      <label className="cl-keyword"><Icon name="search"/><input value={keyword} maxLength={200} onChange={event=>setKeyword(event.target.value)} aria-label="Vị trí, công ty hoặc từ khóa" placeholder="Vị trí, công ty hoặc từ khóa"/></label>
      <label className="cl-location"><Icon name="pin"/><input value={location} maxLength={255} onChange={event=>setLocation(event.target.value)} aria-label="Tỉnh, thành phố" placeholder="Tỉnh, thành phố"/></label>
      <button className="cl-search-button" type="submit" aria-label="Tìm kiếm"><Icon name="search"/><span>Tìm kiếm</span></button>
    </form>
  </div></section>;
}

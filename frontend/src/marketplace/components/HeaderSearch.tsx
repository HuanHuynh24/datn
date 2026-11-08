import { type FormEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useViewState } from '../view-state';
import Icon from './Icon';

type Navigate = (page: string, data?: unknown) => void;

export default function HeaderSearch({ onNavigate }: { onNavigate: Navigate }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const initialKeyword = params.get('keyword') ?? '';
  const initialLocation = params.get('location') ?? '';
  const viewKey = pathname === '/jobs'
    ? 'jobs:' + JSON.stringify([initialKeyword, initialLocation, params.get('category') ?? ''])
    : 'header-search:' + pathname;
  return <SearchForm key={viewKey} viewKey={viewKey} initialKeyword={initialKeyword} initialLocation={initialLocation} onNavigate={onNavigate} />;
}

function SearchForm({ viewKey, initialKeyword, initialLocation, onNavigate }: { viewKey: string; initialKeyword: string; initialLocation: string; onNavigate: Navigate }) {
  const [keyword, setKeyword] = useViewState(viewKey + ':keyword', initialKeyword);
  const [location, setLocation] = useViewState(viewKey + ':location', initialLocation);
  const [, setPage] = useViewState(viewKey + ':page', 1);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onNavigate('job-search', { keyword, location });
  };
  return <form className="cl-nav-search" onSubmit={submit} role="search">
    <label><Icon name="search" /><input aria-label="Từ khóa tìm kiếm trên thanh điều hướng" value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1); }} placeholder="Nhập tên vị trí, công ty, từ khóa" /></label>
    <label><Icon name="pin" /><input aria-label="Địa điểm trên thanh điều hướng" value={location} onChange={event => { setLocation(event.target.value); setPage(1); }} placeholder="Nhập tỉnh, thành phố" /></label>
    <button className="cl-search-button" type="submit"><Icon name="search" />Tìm kiếm</button>
  </form>;
}

export type NavMode = 'public' | 'candidate' | 'recruiter';
export interface HeaderLink { label: string; page: string; pages?: string[] }
export interface HeaderItem extends HeaderLink { children?: HeaderLink[] }

export const headerNavigation: Record<NavMode, HeaderItem[]> = {
  public: [
    { label: 'Tìm việc làm', page: 'job-search', pages: ['job-detail'] },
    { label: 'Công ty', page: 'companies' },
    { label: 'Hồ sơ & CV', page: 'candidate-profile', children: [
      { label: 'Hồ sơ nghề nghiệp', page: 'candidate-profile' },
      { label: 'Quản lý CV', page: 'cv-upload' },
    ] },
    { label: 'Cẩm nang', page: 'career' },
  ],
  candidate: [
    { label: 'Tổng quan', page: 'candidate-home' },
    { label: 'Tìm việc', page: 'job-search', pages: ['job-detail'], children: [
      { label: 'Tất cả việc làm', page: 'job-search', pages: ['job-detail'] },
      { label: 'Khám phá việc làm', page: 'candidate-recommended' },
    ] },
    { label: 'Hồ sơ & CV', page: 'candidate-profile', children: [
      { label: 'Hồ sơ nghề nghiệp', page: 'candidate-profile' },
      { label: 'Quản lý CV', page: 'cv-upload' },
    ] },
    { label: 'Đã lưu', page: 'candidate-saved' },
    { label: 'Đã ứng tuyển', page: 'candidate-applications' },
  ],
  recruiter: [
    { label: 'Tổng quan', page: 'recruiter-home' },
    { label: 'Tin tuyển dụng', page: 'recruiter-jobs', pages: ['recruiter-create-job'] },
    { label: 'Ứng viên', page: 'recruiter-applicants', children: [
      { label: 'Hồ sơ ứng viên', page: 'recruiter-applicants', pages: ['recruiter-candidate'] },
      { label: 'Tìm kiếm nhân tài', page: 'recruiter-search' },
      { label: 'Ứng viên phù hợp', page: 'recruiter-recommended' },
    ] },
    { label: 'Quy trình', page: 'recruiter-pipeline' },
  ],
};
export function isHeaderLinkActive(link: HeaderLink, page: string) {
  return link.page === page || !!link.pages?.includes(page);
}

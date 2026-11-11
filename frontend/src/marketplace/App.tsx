'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useAuthSession } from './auth-client';
import Nav from './components/Nav';
import PageLoading from './components/PageLoading';
import Footer from './components/Footer';
import MobileNav from './components/MobileNav';
import HomePage from './pages/HomePage';
import JobSearchPage from './pages/JobSearchPage';
import CompaniesPage from './pages/CompaniesPage';
import CareerPage from './pages/CareerPage';


import { LiveCVs, LiveApplications } from './pages/LiveApplications';
import AuthPage from './pages/AuthPages';

import CandidateHomePage from './pages/candidate/CandidateHomePage';
import RecommendedJobsPage from './pages/candidate/RecommendedJobsPage';
import CareerProfilePage from './pages/candidate/CareerProfilePage';

import RecruiterHomePage from './pages/recruiter/RecruiterHomePage';


import ApplicantsPage from './pages/recruiter/ApplicantsPage';
import CandidateProfilePage from './pages/recruiter/CandidateProfilePage';
import PipelinePage from './pages/recruiter/PipelinePage';
import CompanyProfilePage from './pages/recruiter/CompanyProfilePage';

import AdminManagement from './pages/AdminManagement';
import { LiveJobDetail, LiveJobEditor, LiveJobList } from './pages/LiveJobs';
import type { Candidate } from './data';
import { candidates, pipelineCandidate } from './data';

import { getPageUrl } from './routes';

type NavMode = 'public' | 'candidate' | 'recruiter';

const candidatePages = new Set([
  'candidate-home', 'candidate-recommended', 'candidate-applications',
  'candidate-profile', 'candidate-saved', 'cv-upload',
]);

const recruiterPages = new Set([
  'recruiter-home', 'recruiter-jobs', 'recruiter-create-job', 'recruiter-edit-job',
  'recruiter-applicants', 'recruiter-candidate', 'recruiter-pipeline',
  'recruiter-recommended', 'recruiter-search', 'recruiter-company',
]);

function getNavMode(page: string): NavMode {
  if (candidatePages.has(page)) return 'candidate';
  if (recruiterPages.has(page)) return 'recruiter';
  return 'public';
}

const PAGES_WITH_FOOTER = new Set([
  'home', 'job-search', 'companies', 'career',
  'candidate-home', 'recruiter-home',
]);

export default function App({ page, itemId }: { page: string; itemId?: string }) {
  const router = useRouter();
  const session = useAuthSession();
  const candidateSession = session?.user.role === 'CANDIDATE';
  const recruiterSession = session?.user.role === 'COMPANY_MEMBER';
  const requiresCandidate = candidatePages.has(page);
  const requiresRecruiter = recruiterPages.has(page);
  const authorized = (!requiresCandidate || candidateSession) && (!requiresRecruiter || recruiterSession);
  useEffect(() => {
    if (!authorized) router.replace(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}${requiresRecruiter ? '&audience=recruiter' : ''}`);
  }, [authorized, requiresRecruiter, router]);
  const pageData = page === 'recruiter-candidate'
      ? [...candidates, pipelineCandidate].find((candidate) => candidate.id === itemId)
      : undefined;

  const navigate = (newPage: string, data?: unknown) => {
    router.push(getPageUrl(newPage, data));
  };

  const routeMode = getNavMode(page);
  const navMode = routeMode === 'public' ? candidateSession ? 'candidate' : recruiterSession ? 'recruiter' : 'public' : routeMode;

  // Pages that suppress nav
  const noNav = ['signin-admin', 'admin', 'signin', 'signup-candidate', 'signup-recruiter'].includes(page);
  const showMobileNav = !noNav && navMode !== 'recruiter';

  const showFooter = PAGES_WITH_FOOTER.has(page);

  if (!authorized) return <PageLoading />;
  if (recruiterPages.has(page) && !['recruiter-home', 'recruiter-company', 'recruiter-jobs', 'recruiter-create-job', 'recruiter-edit-job', 'recruiter-applicants'].includes(page)) {
    const approved = session?.company?.approval_status === 'APPROVED';
    return <div className="min-h-screen bg-bg">
      <Nav mode="recruiter" activePage={page} onNavigate={navigate} />
      <main id="main-content" className="ui-page ui-container">
        <h1>{approved ? 'Chức năng tuyển dụng đang được triển khai' : 'Doanh nghiệp cần được duyệt'}</h1>
        <p>{approved ? 'Chưa có thao tác tuyển dụng nào được thực hiện.' : 'Bạn có thể hoàn thiện hồ sơ và quản lý thành viên trong khi chờ Admin phê duyệt.'}</p>
        <button className="ui-btn" onClick={() => navigate('recruiter-company')}>Hồ sơ công ty</button>
      </main>
    </div>;
  }

  return (
    <div className={`min-h-screen bg-bg ${showMobileNav ? 'pb-14 md:pb-0' : ''}`}>
      <a className="ui-skip" href="#main-content">Đến nội dung chính</a>
      {!noNav && (
        <Nav key={`${page}:${itemId ?? ''}`} mode={navMode} activePage={page} onNavigate={navigate} />
      )}

      {showMobileNav && <MobileNav page={page} candidateMode={navMode === 'candidate'} onNavigate={navigate} />}
      <main className="flex-1" id="main-content" tabIndex={-1}>
        <Suspense fallback={<PageLoading />}>
        {page === 'home' && <HomePage onNavigate={navigate} />}

        {page === 'job-search' && <JobSearchPage onNavigate={navigate} />}

        {page === 'job-detail' && itemId && <LiveJobDetail key={itemId} id={itemId} />}
        {page === 'admin' && <AdminManagement />}

        {page === 'cv-upload' && <LiveCVs />}

        {(page === 'signin-admin' || page === 'signin' || page === 'signup-candidate' || page === 'signup-recruiter') && (
          <AuthPage
            key={page}
            mode={page as 'signin-admin' | 'signin' | 'signup-candidate' | 'signup-recruiter'}
            onNavigate={navigate}
          />
        )}

        {page === 'companies' && <CompaniesPage onNavigate={navigate} />}
        {page === 'career' && <CareerPage onNavigate={navigate} />}

        {/* Candidate pages */}
        {page === 'candidate-home' && <CandidateHomePage onNavigate={navigate} />}
        {page === 'candidate-recommended' && <RecommendedJobsPage onNavigate={navigate} />}
        {page === 'candidate-applications' && <LiveApplications />}
        {page === 'candidate-saved' && <p className="ui-container">Chức năng lưu việc chưa khả dụng.</p>}
        {page === 'candidate-profile' && <CareerProfilePage onNavigate={navigate} />}

        {/* Recruiter pages */}
        {page === 'recruiter-home' && <RecruiterHomePage onNavigate={navigate} />}
        {page === 'recruiter-jobs' && <LiveJobList own />}
        {page === 'recruiter-create-job' && <LiveJobEditor />}
        {page === 'recruiter-edit-job' && itemId && <LiveJobEditor key={itemId} id={itemId} />}
        {page === 'recruiter-applicants' && <LiveApplications employer />}
        {page === 'recruiter-search' && <ApplicantsPage key={page} mode="search" onNavigate={navigate} />}
        {page === 'recruiter-pipeline' && <PipelinePage onNavigate={navigate} />}
        {page === 'recruiter-recommended' && <ApplicantsPage key={page} mode="recommended" onNavigate={navigate} />}

        {page === 'recruiter-candidate' && (
          pageData
            ? <CandidateProfilePage key={itemId} candidate={pageData as Candidate} onNavigate={navigate} />
            : <ApplicantsPage onNavigate={navigate} />
        )}

        {page === 'recruiter-company' && <CompanyProfilePage onNavigate={navigate} />}
        </Suspense>
      </main>

      {showFooter && <Footer onNavigate={navigate} />}
    </div>
  );
}

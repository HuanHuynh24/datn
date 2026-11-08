import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Brand from '../components/Brand';
import Dialog from '../components/Dialog';
import { AUTH_AUDIENCE_SYSTEM_ROLE, type AuthAudience } from '../auth-codes';
import { registerCandidate, signIn } from '../auth-client';
import { getCompanyPackages, registerEmployer, type CompanyPackage } from '../company-client';
import { safeReturnPath } from '../routes';
import { Field, Notice, type Navigate } from '../ui';

export default function AuthPage({ onNavigate, mode }: { onNavigate: Navigate; mode: 'signin-admin' | 'signin' | 'signup-candidate' | 'signup-recruiter' }) {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeReturnPath(params.get('next'));
  const context = params.has('next') ? { next } : undefined;
  const isAdmin = mode === 'signin-admin';
  const isSignIn = mode === 'signin' || isAdmin;
  const [role, setRole] = useState<AuthAudience>(mode === 'signup-recruiter' || params.get('audience') === 'recruiter' ? 'recruiter' : 'candidate');
  const [show, setShow] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);
  const employerSignup = !isSignIn && role === 'recruiter';
  const [packages, setPackages] = useState<CompanyPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(employerSignup);
  useEffect(() => {
    if (!employerSignup) return;
    let active = true;
    getCompanyPackages().then(value => { if (active) setPackages(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải gói doanh nghiệp.'); })
      .finally(() => { if (active) setLoadingPackages(false); });
    return () => { active = false; };
  }, [employerSignup]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const form = event.currentTarget;
    const email = (form.elements.namedItem('auth-email') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('auth-password') as HTMLInputElement).value;
    const name = (form.elements.namedItem('auth-name') as HTMLInputElement | null)?.value.trim() || '';
    let accountCreated = registered;
    setBusy(true);
    try {
      if (!isSignIn && !accountCreated) {
        if (role === 'recruiter') {
          await registerEmployer({ email, full_name: name, password,
            company_name: (form.elements.namedItem('auth-company') as HTMLInputElement).value.trim(),
            tax_code: (form.elements.namedItem('auth-tax-code') as HTMLInputElement).value.trim(),
            package_id: (form.elements.namedItem('auth-package') as HTMLSelectElement).value,
          });
        } else { await registerCandidate(email, name, password); }
        accountCreated = true;
        setRegistered(true);
      }
      await signIn(email, password, isAdmin ? 'ADMIN' : AUTH_AUDIENCE_SYSTEM_ROLE[role]);
      form.reset();
      router.push(isAdmin ? '/admin' : role === 'recruiter' ? (next.startsWith('/recruiter') ? next : '/recruiter') : (next.startsWith('/recruiter') ? '/candidate' : next));
    } catch (reason) {
      setError((accountCreated ? 'Tài khoản đã được tạo. Bạn có thể đăng nhập lại. ' : '') + (reason instanceof Error ? reason.message : 'Không thể hoàn tất thao tác.'));
    } finally { setBusy(false); }
  }

  return <div className="ui-auth">
    <button className="ui-auth-logo" onClick={() => onNavigate('home')} aria-label="Talentiq - Trang chủ"><Brand /></button>
    <section className="ui-auth-card">
      <h1>{isAdmin ? 'Đăng nhập Admin' : isSignIn ? 'Đăng nhập Talentiq' : role === 'recruiter' ? 'Kết nối với ứng viên phù hợp' : 'Bắt đầu hành trình nghề nghiệp'}</h1>
      <p className="ui-description">{isSignIn ? 'Đăng nhập để tiếp tục với tài khoản của bạn.' : 'Tạo hồ sơ để khám phá những cơ hội dành cho bạn.'}</p>
      {!isAdmin && <div className="ui-tabs" aria-label="Chọn vai trò">{([['candidate', 'Ứng viên'], ['recruiter', 'Nhà tuyển dụng']] as const).map(([value, title]) => <button key={value} disabled={busy} aria-pressed={role === value} onClick={() => isSignIn ? setRole(value) : onNavigate(value === 'recruiter' ? 'signup-recruiter' : 'signup-candidate', context)}>{title}</button>)}</div>}
      {employerSignup && <Notice>Người đăng ký sẽ quản lý doanh nghiệp. Doanh nghiệp cần được duyệt trước khi tuyển dụng; các gói hiện chưa thu phí.</Notice>}
      {error && <div role="alert"><Notice error>{error}</Notice></div>}
      <form className="ui-form" onSubmit={submit} aria-busy={busy}>
        {!isSignIn && <Field id="auth-name" label="Họ và tên *"><input id="auth-name" autoComplete="name" required maxLength={255} disabled={busy || registered} placeholder="Nhập họ và tên" /></Field>}
        {employerSignup && <>
          <Field id="auth-company" label="Tên công ty *"><input id="auth-company" autoComplete="organization" required maxLength={255} placeholder="Nhập tên công ty" /></Field>
          <Field id="auth-tax-code" label="Mã số thuế *"><input id="auth-tax-code" required maxLength={30} placeholder="Nhập mã số thuế doanh nghiệp" /></Field>
          <Field id="auth-package" label="Gói doanh nghiệp *"><select id="auth-package" required defaultValue="" disabled={loadingPackages || packages.length === 0}>
            <option value="">{loadingPackages ? 'Đang tải gói…' : packages.length ? 'Chọn gói' : 'Chưa có gói được cấu hình'}</option>
            {packages.map(item => <option key={item.package_id} value={item.package_id} disabled={item.member_limit === null || item.member_limit < 1}>{item.name} · {item.member_limit ?? 'Chưa cấu hình'} thành viên · {item.monthly_price}/tháng</option>)}
          </select></Field>
        </>}
        <Field id="auth-email" label="Email *"><input id="auth-email" type="email" autoComplete="email" required maxLength={255} disabled={busy || registered} placeholder="ban@example.com" /></Field>
        <Field id="auth-password" label="Mật khẩu *" hint={!isSignIn ? 'Sử dụng ít nhất 8 ký tự.' : undefined}><div className="ui-password"><input id="auth-password" type={show ? 'text' : 'password'} autoComplete={isSignIn ? 'current-password' : 'new-password'} minLength={isSignIn ? 1 : 8} maxLength={1024} required disabled={busy} placeholder="Nhập mật khẩu" /><button type="button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Ẩn' : 'Hiện'}</button></div></Field>
        {isSignIn && <button type="button" className="ui-link" style={{ alignSelf: 'flex-end' }} onClick={() => setForgot(true)}>Quên mật khẩu?</button>}
        <button className="ui-btn ui-btn-primary" type="submit" disabled={busy || (employerSignup && (loadingPackages || packages.length === 0))}>{busy ? 'Đang xử lý…' : isSignIn || registered ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
      </form>
      {!isAdmin && <p className="ui-auth-switch">{isSignIn ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}<button className="ui-link" onClick={() => onNavigate(isSignIn ? 'signup-candidate' : 'signin', context)}>{isSignIn ? 'Đăng ký ngay' : 'Đăng nhập'}</button></p>}
    </section>
    <p className="ui-auth-note">Bạn cần đăng nhập lại khi tải lại trang. Đăng xuất trong menu tài khoản để kết thúc phiên trên trình duyệt.</p>
    <button className="ui-link" style={{ marginTop: 16 }} onClick={() => onNavigate('home')}>← Về trang chủ</button>
    {forgot && <Dialog title="Khôi phục mật khẩu" onClose={() => setForgot(false)}><p>Chức năng khôi phục mật khẩu chưa khả dụng. Chưa có email khôi phục được gửi.</p><button className="ui-btn" onClick={() => setForgot(false)}>Quay lại đăng nhập</button></Dialog>}
  </div>;
}

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {ApiError,apiRequest,logout,setSignInNotice,useAuthSession} from '../auth-client';
import {Field,Notice} from '../ui';
import Dialog from './Dialog';

export default function AccountPasswordButton({className='site-menu-link'}:{className?:string}) {
  const session=useAuthSession();const router=useRouter();
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||!session)return;
    const form=new FormData(event.currentTarget);
    const current=String(form.get('current_password')),next=String(form.get('new_password'));
    if(next!==String(form.get('confirmation'))){setError('Mật khẩu nhập lại chưa khớp.');return;}
    if(current===next){setError('Mật khẩu mới phải khác mật khẩu hiện tại.');return;}
    setBusy(true);setError('');
    try{
      await apiRequest('/api/v1/auth/change-password',{method:'POST',body:JSON.stringify({current_password:current,new_password:next})});
      const role=session.user.role;logout();setSignInNotice('Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
      router.replace(role==='ADMIN'?'/admin/sign-in':role==='COMPANY_MEMBER'?'/sign-in?audience=recruiter':'/sign-in');
    }catch(reason){setError(reason instanceof ApiError&&reason.status===400?'Mật khẩu hiện tại chưa đúng.':reason instanceof ApiError&&reason.status===422?'Mật khẩu mới chưa hợp lệ. Dùng từ 8 đến 1024 ký tự.':reason instanceof Error?reason.message:'Chưa đổi được mật khẩu. Vui lòng thử lại.');}
    finally{setBusy(false);}
  }
  return <><button type="button" className={className} onClick={()=>{setError('');setOpen(true);}}>Đổi mật khẩu</button>{open&&<Dialog title="Đổi mật khẩu" onClose={()=>{if(!busy)setOpen(false);}}><form className="ui-form" onSubmit={submit}>
    <p>Sau khi đổi mật khẩu, bạn cần đăng nhập lại.</p>
    {error&&<Notice error>{error}</Notice>}
    <fieldset disabled={busy} style={{border:0,padding:0,display:'grid',gap:16}}>
      <Field id="account-current-password" label="Mật khẩu hiện tại"><input id="account-current-password" name="current_password" type="password" autoComplete="current-password" required maxLength={1024}/></Field>
      <Field id="account-new-password" label="Mật khẩu mới" hint="Từ 8 đến 1024 ký tự."><input id="account-new-password" name="new_password" type="password" autoComplete="new-password" required minLength={8} maxLength={1024}/></Field>
      <Field id="account-confirm-password" label="Nhập lại mật khẩu mới"><input id="account-confirm-password" name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={1024}/></Field>
      <button className="ui-btn ui-btn-primary" type="submit">{busy?'Đang đổi mật khẩu…':'Lưu mật khẩu mới'}</button>
    </fieldset>
  </form></Dialog>}</>;
}

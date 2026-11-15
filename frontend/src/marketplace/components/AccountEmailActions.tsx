import {useState,type FormEvent} from 'react';
import {anonymousApiRequest,apiRequest} from '../auth-client';
import {Field,Notice} from '../ui';
import Dialog from './Dialog';

const failure=(reason:unknown)=>reason instanceof Error?reason.message:'Chưa gửi được yêu cầu. Vui lòng thử lại sau.';
export function PasswordResetRequestDialog({initialEmail='',onClose}:{initialEmail?:string;onClose:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;const form=new FormData(event.currentTarget);setBusy(true);setError('');
    try{await anonymousApiRequest('/api/v1/auth/password-reset/request',{method:'POST',body:JSON.stringify({email:String(form.get('email')).trim()})});setSent(true);}
    catch(reason){setError(failure(reason));}finally{setBusy(false);}
  }
  return <Dialog title="Quên mật khẩu" onClose={()=>{if(!busy)onClose();}}>{sent?<><Notice>Nếu email thuộc tài khoản phù hợp, hãy kiểm tra hộp thư và thư rác để lấy liên kết đặt lại mật khẩu.</Notice><p>Liên kết có hiệu lực 15 phút. Bạn có thể thử gửi lại sau 60 giây.</p><button className="ui-btn" onClick={onClose}>Quay lại đăng nhập</button></>:<form className="ui-form" onSubmit={submit}><p>Nhập email tài khoản để yêu cầu liên kết đặt lại mật khẩu.</p>{error&&<Notice error>{error}</Notice>}<Field id="reset-request-email" label="Email tài khoản"><input id="reset-request-email" name="email" type="email" defaultValue={initialEmail} maxLength={255} autoComplete="email" required disabled={busy}/></Field><button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>{busy?'Đang gửi yêu cầu…':'Gửi liên kết đặt lại'}</button></form>}</Dialog>;
}

export function AccountEmailButton({className='site-menu-link'}:{className?:string}) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [account,setAccount]=useState<{email:string;email_verified:boolean}>();
  async function load(){setBusy(true);setError('');try{setAccount(await apiRequest('/api/v1/auth/account'));}catch(reason){setError(failure(reason));}finally{setBusy(false);}}
  async function send(){if(busy)return;setBusy(true);setError('');setMessage('');try{await apiRequest('/api/v1/auth/email-verification/request',{method:'POST'});setMessage('Nếu email cần xác thực, hãy kiểm tra hộp thư và thư rác. Liên kết có hiệu lực 24 giờ.');}catch(reason){setError(failure(reason));}finally{setBusy(false);}}
  return <><button type="button" className={className} onClick={()=>{setOpen(true);setMessage('');setAccount(undefined);void load();}}>Xác thực email</button>{open&&<Dialog title="Email tài khoản" onClose={()=>{if(!busy)setOpen(false);}}>{error&&<Notice error>{error}</Notice>}{account?<div className="ui-stack"><p>{account.email}</p><Notice>{account.email_verified?'Email đã được xác thực.':'Email chưa được xác thực. Bạn vẫn có thể sử dụng tài khoản.'}</Notice>{message&&<Notice>{message}</Notice>}{!account.email_verified&&<button className="ui-btn ui-btn-primary" disabled={busy} onClick={()=>void send()}>{busy?'Đang gửi yêu cầu…':'Gửi email xác thực'}</button>}<button className="ui-btn" disabled={busy} onClick={()=>void load()}>Kiểm tra lại trạng thái</button></div>:busy&&<p role="status">Đang tải thông tin tài khoản…</p>}</Dialog>}</>;
}

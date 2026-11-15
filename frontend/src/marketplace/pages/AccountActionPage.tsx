import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import Brand from '../components/Brand';
import {ApiError,anonymousApiRequest,logout} from '../auth-client';
import {Field,Notice} from '../ui';

export default function AccountActionPage({verify=false}:{verify?:boolean}) {
  const params=useSearchParams();const read=useRef(false);
  const [link,setLink]=useState({ready:false,token:''}),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
  const signIn=params.get('audience')==='admin'?'/admin/sign-in':params.get('audience')==='recruiter'?'/sign-in?audience=recruiter':'/sign-in';
  useEffect(()=>{if(read.current)return;read.current=true;const token=new URLSearchParams(window.location.hash.slice(1)).get('token')??'';window.history.replaceState(null,'',window.location.pathname+window.location.search);queueMicrotask(()=>setLink({ready:true,token}));},[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||!link.token)return;const form=new FormData(event.currentTarget);const password=String(form.get('new_password')??'');
    if(!verify&&password!==String(form.get('confirmation'))){setError('Mật khẩu nhập lại chưa khớp.');return;}
    setBusy(true);setError('');
    try{await anonymousApiRequest('/api/v1/auth/'+(verify?'email-verification/confirm':'password-reset/confirm'),{method:'POST',body:JSON.stringify({token:link.token,...(!verify?{new_password:password}:{})})});if(!verify)logout();setDone(true);setLink({ready:true,token:''});}
    catch(reason){setError(reason instanceof ApiError&&reason.status===503?'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.':verify?'Liên kết xác thực email không hợp lệ, đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu liên kết mới.':'Chưa đặt lại được mật khẩu. Liên kết có thể đã hết hạn, đã được sử dụng hoặc mật khẩu mới trùng mật khẩu cũ. Vui lòng thử lại hoặc yêu cầu liên kết mới.');}
    finally{setBusy(false);}
  }
  return <div className="ui-auth"><Link href="/" className="ui-auth-logo"><Brand/></Link><section className="ui-auth-card"><h1>{verify?'Xác thực email':'Đặt lại mật khẩu'}</h1>{!link.ready?<p role="status">Đang kiểm tra liên kết…</p>:done?<><Notice>{verify?'Email đã được xác thực thành công.':'Đã đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.'}</Notice><Link className="ui-btn ui-btn-primary" href={signIn}>Đăng nhập</Link></>:!link.token?<><Notice error>Liên kết chưa đầy đủ. Hãy mở liên kết trong email hoặc yêu cầu liên kết mới.</Notice><Link className="ui-btn" href={signIn}>Quay lại đăng nhập</Link></>:<form className="ui-form" onSubmit={submit}><p>{verify?'Xác nhận email này thuộc tài khoản của bạn.':'Nhập mật khẩu mới cho tài khoản của bạn.'}</p>{error&&<Notice error>{error}</Notice>}{!verify&&<><Field id="reset-new-password" label="Mật khẩu mới"><input id="reset-new-password" name="new_password" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required disabled={busy}/></Field><Field id="reset-confirm-password" label="Nhập lại mật khẩu mới"><input id="reset-confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required disabled={busy}/></Field></>}<button className="ui-btn ui-btn-primary" disabled={busy}>{busy?'Đang xử lý…':verify?'Xác thực email':'Lưu mật khẩu mới'}</button><Link href={signIn}>Quay lại đăng nhập</Link></form>}</section></div>;
}

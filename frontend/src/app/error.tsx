'use client';
import Link from 'next/link';
export default function ErrorPage({retry}:{error:unknown;retry:()=>void}){return <main className="ui-auth"><div className="ui-auth-card" style={{textAlign:'center'}}><h1>Chưa thể hiển thị trang</h1><p className="ui-description">Có sự cố khi tải nội dung. Vui lòng thử lại hoặc trở về trang chủ.</p><div className="ui-actions" style={{justifyContent:'center'}}><Link className="ui-btn" href="/">Về trang chủ</Link><button className="ui-btn ui-btn-primary" onClick={retry}>Thử lại</button></div></div></main>;}

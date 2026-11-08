import {useEffect,useRef,useState} from 'react';
import {Page,Panel,Field,Notice,type Navigate} from '../ui';
import {useDemo,updateDemo,type CandidateCV} from '../demo-store';
import {saveCVFile,readCVFile,deleteCVFile} from '../cv-storage';
import Icon from '../components/Icon';
import Dialog from '../components/Dialog';
import CVDocument from '../components/CVDocument';
import ProfileNavigation from '../components/ProfileNavigation';

const MAX_FILES=5;
const fileSize=(size:number)=>!size?'Chưa rõ dung lượng':size>=1024*1024?`${(size/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(size/1024))} KB`;
const fileDate=(date:string)=>date?new Date(date).toLocaleDateString('vi-VN'):'Đã lưu trước đó';

export default function CVUploadPage({onNavigate}:{onNavigate:Navigate}) {
  const {cvs,defaultCvId,profile}=useDemo();
  const [selected,setSelected]=useState<File|null>(null);
  const [fileTitle,setFileTitle]=useState('');
  const [makeDefault,setMakeDefault]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [dragging,setDragging]=useState(false);
  const [busy,setBusy]=useState(false);
  const [preview,selectPreview]=useState<CandidateCV|null>(null);
  const [previewFile,setPreviewFile]=useState<{id:string;url:string;error:string}|null>(null);
  const setPreview=(cv:CandidateCV|null)=>{setPreviewFile(null);selectPreview(cv);};
  const previewUrl=previewFile?.id===preview?.id?previewFile?.url??'':'';
  const previewError=previewFile?.id===preview?.id?previewFile?.error??'':'';
  const previewLoading=!!preview&&preview.type!=='profile'&&previewFile?.id!==preview.id;
  const [removing,setRemoving]=useState<CandidateCV|null>(null);
  const [renaming,setRenaming]=useState<CandidateCV|null>(null);
  const [rename,setRename]=useState('');
  const [creating,setCreating]=useState(false);
  const [template,setTemplate]=useState<'classic'|'modern'>('classic');
  const [profileTitle,setProfileTitle]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const activeCV=cvs.find(cv=>cv.id===defaultCvId);
  const checklist=[{title:'Thông tin liên hệ',done:!!(profile.email&&profile.phone)},{title:'Kinh nghiệm làm việc',done:!!profile.experience.trim()},{title:'Kỹ năng chuyên môn',done:!!profile.skills.trim()},{title:'Học vấn',done:!!profile.education.trim()}];

  useEffect(()=>{
    if(!preview||preview.type==='profile')return;
    let canceled=false;let url='';
    readCVFile(preview.id).then(file=>{
      if(canceled)return;
      if(!file){setPreviewFile({id:preview.id,url:'',error:'Tệp không còn trong trình duyệt. Vui lòng tải lại CV để xem nội dung.'});return;}
      url=URL.createObjectURL(new Blob([file],{type:preview.type==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
      setPreviewFile({id:preview.id,url,error:''});
    }).catch(()=>{if(!canceled)setPreviewFile({id:preview.id,url:'',error:'Chưa thể mở tệp trong trình duyệt. Vui lòng thử lại.'});});
    return()=>{canceled=true;if(url)URL.revokeObjectURL(url);};
  },[preview]);

  function select(file:File) {
    setError('');setNotice('');
    if(!/\.(pdf|docx)$/i.test(file.name)){setError('Vui lòng chọn tệp PDF hoặc DOCX.');return;}
    if(file.size>10*1024*1024){setError('Tệp vượt quá 10 MB. Hãy chọn một tệp nhỏ hơn.');return;}
    if(!file.size){setError('Tệp đang trống. Vui lòng kiểm tra và chọn lại.');return;}
    if(cvs.length>=MAX_FILES){setError('Bạn đã có 5 CV. Hãy xóa một CV trước khi thêm bản mới.');return;}
    setSelected(file);setFileTitle(file.name.replace(/\.(pdf|docx)$/i,''));setMakeDefault(!cvs.length);
  }
  function addRecord(cv:CandidateCV,primary:boolean) {
    updateDemo(state=>({cvs:[cv,...state.cvs],...(primary||!state.defaultCvId?{defaultCvId:cv.id,cvName:cv.name}:{})}));
    setNotice(`Đã thêm “${cv.name}”${primary||!defaultCvId?' và đặt làm CV mặc định':''}.`);
  }
  async function saveFile() {
    if(!selected||busy)return;
    if(cvs.length>=MAX_FILES){setError('Bạn đã có 5 CV. Hãy xóa một CV trước khi thêm bản mới.');return;}
    setBusy(true);setError('');
    const cv:CandidateCV={id:crypto.randomUUID(),name:fileTitle.trim()||selected.name,fileName:selected.name,size:selected.size,type:/\.pdf$/i.test(selected.name)?'pdf':'docx',updatedAt:new Date().toISOString()};
    try {await saveCVFile(cv.id,selected);addRecord(cv,makeDefault);setSelected(null);}
    catch {setError('Chưa lưu được tệp trên thiết bị. Kiểm tra dung lượng trình duyệt và thử lại.');}
    finally {setBusy(false);}
  }
  function startCreate() {
    setError('');setNotice('');
    if(cvs.length>=MAX_FILES){setError('Bạn đã có 5 CV. Hãy xóa một CV trước khi thêm bản mới.');return;}
    setProfileTitle(`CV ${profile.name}`);setCreating(true);
  }
  function setDefault(cv:CandidateCV) {
    updateDemo({defaultCvId:cv.id,cvName:cv.name});setNotice(`Đã chọn “${cv.name}” làm CV mặc định.`);
  }
  async function remove() {
    if(!removing||busy)return;
    setBusy(true);
    try {
      if(removing.type!=='profile')await deleteCVFile(removing.id);
      updateDemo(state=>{const remaining=state.cvs.filter(cv=>cv.id!==removing.id);const next=state.defaultCvId===removing.id?remaining[0]:remaining.find(cv=>cv.id===state.defaultCvId);return {cvs:remaining,defaultCvId:next?.id??'',cvName:next?.name??''};});
      setRemoving(null);setNotice('Đã xóa CV khỏi danh sách.');
    } catch {setError('Chưa thể xóa tệp. Vui lòng thử lại.');setRemoving(null);}
    finally {setBusy(false);}
  }
  async function download(cv:CandidateCV) {
    try {
      const file=await readCVFile(cv.id);if(!file)throw new Error('missing');
      const url=URL.createObjectURL(file);const link=document.createElement('a');link.href=url;link.download=cv.fileName;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch {setError('Tệp không còn trong trình duyệt. Hãy tải lại CV để sử dụng.');}
  }

  return <Page visual="candidate" eyebrow="Hồ sơ & CV" title="Quản lý CV" description="Lưu các bản CV, xem trước và chọn bản mặc định khi ứng tuyển. Bạn có thể tải tệp có sẵn hoặc tạo CV từ hồ sơ nghề nghiệp.">
    <ProfileNavigation active="cvs"/>
    <div className="ui-cv-overview"><div><span className="ui-cv-side-icon"><Icon name="document"/></span><div><strong>{cvs.length} / {MAX_FILES} CV</strong><p>Lưu nhiều phiên bản cho từng vị trí</p></div></div><div><span className={activeCV?'ui-cv-overview-check':'ui-cv-side-icon'}><Icon name={activeCV?'check':'document'}/></span><div><strong>{activeCV?'Đã chọn CV mặc định':'Chưa có CV mặc định'}</strong><p>{activeCV?.name??'Thêm CV đầu tiên để bắt đầu'}</p></div></div></div>
    {notice&&<Notice>{notice}</Notice>}
    <div className="ui-cv-layout"><div className="ui-stack">
      <Panel title="Thêm CV mới" action={<span className="ui-small ui-muted">PDF, DOCX · Tối đa 10 MB</span>}>
        <p className="ui-cv-intro">Bạn đã có CV? Tải tệp lên để lưu và xem trước ngay tại đây.</p>
        <input ref={input} type="file" accept=".pdf,.docx" className="sr-only" tabIndex={-1} aria-label="Chọn tệp CV" onChange={e=>{const file=e.target.files?.[0];if(file)select(file);e.target.value='';}}/>
        <button type="button" className="ui-cv-dropzone" disabled={busy} data-dragging={dragging} onClick={()=>input.current?.click()} onDragOver={e=>{e.preventDefault();if(!busy)setDragging(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDragging(false);}} onDrop={e=>{e.preventDefault();setDragging(false);if(busy)return;if(e.dataTransfer.files.length!==1){setError('Vui lòng chọn một tệp CV mỗi lần.');return;}select(e.dataTransfer.files[0]);}}>
          <span className="ui-cv-upload-art" aria-hidden="true"><span>CV</span><Icon name="document"/><b>↑</b></span>
          <strong>{dragging?'Thả tệp để thêm CV':'Kéo thả CV của bạn vào đây'}</strong><span className="ui-muted">hoặc chọn tệp từ thiết bị</span><span className="ui-btn ui-btn-primary"><Icon name="document"/>Chọn tệp CV</span><small>Giữ nguyên định dạng và nội dung CV của bạn</small>
        </button>
        {error&&<Notice error>{error}</Notice>}
        {selected&&<form className="ui-cv-selected ui-form" onSubmit={e=>{e.preventDefault();void saveFile();}}><div className="ui-file"><span className="ui-cv-file-type">{selected.name.toLowerCase().endsWith('.pdf')?'PDF':'DOCX'}</span><div className="ui-grow"><strong>{selected.name}</strong><p className="ui-small ui-muted">{fileSize(selected.size)} · Đã chọn, chưa lưu</p></div><button type="button" className="ui-btn" disabled={busy} aria-label="Bỏ tệp đã chọn" onClick={()=>setSelected(null)}><Icon name="close"/></button></div><Field id="cv-title" label="Tên CV" hint="Đặt tên theo vị trí ứng tuyển để dễ tìm lại."><input id="cv-title" value={fileTitle} onChange={e=>setFileTitle(e.target.value)} required maxLength={100}/></Field><label className="ui-check"><input type="checkbox" checked={makeDefault} disabled={!cvs.length} onChange={e=>setMakeDefault(e.target.checked)}/>Đặt làm CV mặc định khi ứng tuyển</label><div className="ui-actions"><button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>{busy?'Đang lưu tệp…':'Lưu CV'}</button><button type="button" className="ui-link" disabled={busy} onClick={()=>input.current?.click()}>Chọn tệp khác</button></div></form>}
        <p className="ui-cv-privacy"><Icon name="shield"/>CV được lưu trên thiết bị này; chưa gửi cho nhà tuyển dụng.</p>
      </Panel>
      <Panel title="CV đã lưu" action={<span className="ui-cv-count">{cvs.length}</span>}>
        {cvs.length?<div className="ui-cv-list">{cvs.map(cv=><article className="ui-cv-card" key={cv.id} data-default={cv.id===defaultCvId}><div className="ui-cv-card-main"><button className={`ui-cv-file-thumb ui-cv-file-thumb-${cv.type}`} aria-label={`Xem trước ${cv.name}`} onClick={()=>setPreview(cv)}><Icon name="document"/><span>{cv.type==='profile'?'HỒ SƠ':cv.type.toUpperCase()}</span></button><div className="ui-grow"><div className="ui-cv-card-title"><h3><button onClick={()=>setPreview(cv)}>{cv.name}</button></h3>{cv.id===defaultCvId&&<span className="ui-badge ui-badge-green"><Icon name="check"/>Mặc định</span>}</div><p className="ui-small ui-muted">{cv.type==='profile'?'Tạo từ hồ sơ nghề nghiệp':`${cv.type.toUpperCase()} · ${fileSize(cv.size)}`} · {fileDate(cv.updatedAt)}</p><p className="ui-cv-original">{cv.type==='profile'?'Bản lưu độc lập từ thông tin hồ sơ của bạn':cv.fileName}</p></div></div><div className="ui-cv-card-actions"><button className="ui-link" onClick={()=>setPreview(cv)}>Xem trước</button>{cv.id!==defaultCvId&&<button className="ui-link" onClick={()=>setDefault(cv)}>Đặt mặc định</button>}{cv.type!=='profile'&&<button className="ui-link" onClick={()=>void download(cv)}>Tải xuống</button>}<button className="ui-link" onClick={()=>{setRename(cv.name);setRenaming(cv);}}>Đổi tên</button><button className="ui-cv-delete" aria-label={`Xóa ${cv.name}`} onClick={()=>setRemoving(cv)}><Icon name="close"/>Xóa</button></div></article>)}</div>:<div className="ui-cv-empty"><span className="ui-cv-empty-icon"><Icon name="document"/></span><div><h3>CV đầu tiên của bạn bắt đầu từ đây</h3><p>Tải CV có sẵn hoặc tạo một bản từ hồ sơ nghề nghiệp.</p><button className="ui-link" onClick={startCreate}>Tạo CV từ hồ sơ →</button></div></div>}
      </Panel>
    </div><aside className="ui-stack">
      <Panel className="ui-cv-create-panel"><div className="ui-cv-mini-preview" aria-hidden="true"><div className="ui-cv-mini-sidebar"><i/><i/><i/></div><div><b>HỌ VÀ TÊN</b><span>VỊ TRÍ ỨNG TUYỂN</span><i/><i/><strong>KINH NGHIỆM</strong><i/><i/><i/><strong>HỌC VẤN</strong><i/><i/></div></div><h2>Chưa có CV sẵn?</h2><p className="ui-text">Biến thông tin hồ sơ thành CV gọn gàng với hai bố cục có sẵn.</p><button className="ui-btn ui-btn-primary" onClick={startCreate}>Tạo CV từ hồ sơ<Icon name="right"/></button></Panel>
      <Panel title="Một CV tốt cần có"><ul className="ui-cv-checklist">{checklist.map(item=><li key={item.title} data-complete={item.done}><span><Icon name={item.done?'check':'pen'}/></span><div>{item.title}<small>{item.done?'Đã có trong hồ sơ':'Bổ sung để hoàn thiện CV'}</small></div></li>)}</ul><button className="ui-link" onClick={()=>onNavigate('candidate-profile')}>Cập nhật hồ sơ nghề nghiệp →</button></Panel>
      <Panel title="Để CV dễ được đọc"><ul className="ui-cv-tips"><li>Ưu tiên PDF để giữ bố cục trên mọi thiết bị.</li><li>Trình bày kinh nghiệm gần nhất trước, làm rõ kết quả đã đạt được.</li><li>Đặt tên tệp dễ nhận biết, ví dụ: Nguyen_An_Frontend.pdf.</li></ul><button className="ui-link" onClick={()=>onNavigate('career')}>Xem cẩm nang viết CV →</button></Panel>
    </aside></div>
    <div className="ui-cv-next"><div><h2>CV đã sẵn sàng?</h2><p>Khám phá toàn bộ việc làm và chọn cơ hội phù hợp với bạn.</p></div><button className="ui-btn ui-btn-primary" onClick={()=>onNavigate('job-search')}>Khám phá việc làm<Icon name="arrow"/></button></div>

    {preview&&<Dialog title="Xem trước CV" className="ui-cv-preview-dialog" onClose={()=>setPreview(null)}><div className="ui-cv-preview-toolbar"><div><h3>{preview.name}</h3><p className="ui-small ui-muted">{preview.type==='profile'?'CV được tạo từ hồ sơ':preview.fileName}</p></div>{preview.type!=='profile'&&previewUrl&&<a className="ui-btn" href={previewUrl} download={preview.fileName}>Tải xuống</a>}</div>{preview.type==='profile'&&preview.profile?<CVDocument profile={preview.profile} template={preview.template}/>:previewLoading?<p className="ui-cv-preview-placeholder" role="status">Đang mở tệp CV…</p>:previewError?<Notice error>{previewError}</Notice>:previewUrl&&(preview.type==='pdf'?<><iframe className="ui-cv-pdf" title={`Nội dung ${preview.name}`} src={previewUrl}/><p className="ui-small ui-muted">Nếu thiết bị chưa hỗ trợ đọc PDF, hãy tải tệp xuống để xem.</p></>:<div className="ui-cv-preview-placeholder"><Icon name="document"/><h3>Tệp Word đã sẵn sàng</h3><p>Tải xuống và mở bằng ứng dụng đọc DOCX để xem đúng bố cục.</p><a className="ui-btn ui-btn-primary" href={previewUrl} download={preview.fileName}>Tải tệp DOCX</a></div>)}</Dialog>}
    {creating&&<Dialog title="Tạo CV từ hồ sơ" className="ui-cv-preview-dialog" onClose={()=>setCreating(false)}><form className="ui-form" onSubmit={e=>{e.preventDefault();if(cvs.length>=MAX_FILES){setCreating(false);setError('Bạn đã có 5 CV. Hãy xóa một CV trước khi thêm bản mới.');return;}addRecord({id:crypto.randomUUID(),name:profileTitle.trim()||`CV ${profile.name}`,fileName:'',size:0,type:'profile',profile:{...profile},template,updatedAt:new Date().toISOString()},!defaultCvId);setCreating(false);}}><div className="ui-cv-create-controls"><Field id="profile-cv-title" label="Tên CV"><input id="profile-cv-title" required maxLength={100} value={profileTitle} onChange={e=>setProfileTitle(e.target.value)}/></Field><fieldset><legend>Bố cục</legend><div className="ui-tabs"><button type="button" aria-pressed={template==='classic'} onClick={()=>setTemplate('classic')}>Cơ bản</button><button type="button" aria-pressed={template==='modern'} onClick={()=>setTemplate('modern')}>Chuyên nghiệp</button></div></fieldset></div><p className="ui-small ui-muted">Nội dung lấy từ hồ sơ hiện tại. Bạn có thể cập nhật hồ sơ trước khi tạo phiên bản mới.</p><CVDocument profile={profile} template={template}/><div className="ui-form-actions"><button type="button" className="ui-btn" onClick={()=>setCreating(false)}>Hủy</button><button className="ui-btn ui-btn-primary">Lưu CV này</button></div></form></Dialog>}
    {renaming&&<Dialog title="Đổi tên CV" onClose={()=>setRenaming(null)}><form className="ui-form" onSubmit={e=>{e.preventDefault();const name=rename.trim();if(!name)return;updateDemo(state=>({cvs:state.cvs.map(cv=>cv.id===renaming.id?{...cv,name}:cv),...(state.defaultCvId===renaming.id?{cvName:name}:{})}));setRenaming(null);setNotice('Đã cập nhật tên CV.');}}><Field id="rename-cv" label="Tên CV"><input id="rename-cv" required maxLength={100} value={rename} onChange={e=>setRename(e.target.value)}/></Field><div className="ui-form-actions"><button type="button" className="ui-btn" onClick={()=>setRenaming(null)}>Hủy</button><button className="ui-btn ui-btn-primary">Lưu tên</button></div></form></Dialog>}
    {removing&&<Dialog title="Xóa CV này?" onClose={()=>{if(!busy)setRemoving(null);}}><p className="ui-text">“{removing.name}” sẽ được xóa khỏi danh sách và bộ nhớ CV trên thiết bị.{removing.id===defaultCvId&&cvs.length>1?' CV tiếp theo sẽ được đặt làm mặc định.':''}</p><div className="ui-form-actions"><button className="ui-btn" disabled={busy} onClick={()=>setRemoving(null)}>Giữ lại</button><button className="ui-btn ui-btn-danger" disabled={busy} onClick={()=>void remove()}>{busy?'Đang xóa…':'Xóa CV'}</button></div></Dialog>}
  </Page>;
}


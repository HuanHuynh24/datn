'use client';
import { useSyncExternalStore } from 'react';
import { applications, type PipelineStage, type AppStatus } from './data';
export interface Profile { name:string;title:string;location:string;email:string;phone:string;about:string;skills:string;experience:string;education:string;languages:string;projects:string }
export interface CandidateCV { id:string; name:string; fileName:string; size:number; type:'pdf'|'docx'|'profile'; updatedAt:string; profile?:Profile; template?:'classic'|'modern' }
export interface CompanyProfile { name:string;industry:string;size:string;location:string;website:string;email:string;description:string;benefits:string }
export type JobStatus = 'Active'|'Paused'|'Closed';
export interface DemoApplication { id:string;jobId:string;date:string;status:AppStatus;interview?:string;cvName?:string;contactName?:string;contactEmail?:string;coverLetter?:string }
interface DemoState { savedJobs:string[];savedCandidates:string[];applications:DemoApplication[];jobStatuses:Record<string,JobStatus>;candidateStatuses:Record<string,PipelineStage>;notes:Record<string,string>;interviews:Record<string,string>;profile:Profile;company:CompanyProfile;cvName:string;cvs:CandidateCV[];defaultCvId:string;jobTitles:Record<string,string> }
const initial:DemoState={
  savedJobs:['j1','j3'],savedCandidates:[],applications:applications.map(a=>({id:a.id,jobId:a.job.id,date:a.appliedDate,status:a.status,interview:a.interview?'14:00 · 28/01/2024 (lịch mẫu)':undefined})),
  jobStatuses:{j1:'Active',j2:'Active',j3:'Active',j4:'Active',j5:'Paused',j6:'Paused'},candidateStatuses:{},notes:{},interviews:{},cvName:'',cvs:[],defaultCvId:'',jobTitles:{},
  profile:{name:'Nguyễn Alex Tuấn',title:'Senior Backend Developer',location:'Hà Nội',email:'alex.tuan@example.com',phone:'',about:'Lập trình viên backend với 5 năm kinh nghiệm phát triển API và hệ thống phân tán. Yêu thích kiến trúc rõ ràng, làm việc nhóm và chia sẻ kiến thức.',skills:'Python, Django, PostgreSQL, Docker, REST API, Redis, TypeScript',experience:'Senior Backend Developer · Axon Technologies\n03/2022 – Hiện tại\nThiết kế API và kiến trúc microservices, phối hợp với đội sản phẩm để cải thiện hiệu năng.\n\nBackend Developer · Vela Commerce\n01/2020 – 02/2022\nPhát triển và bảo trì API cho nền tảng thương mại điện tử.',education:'Cử nhân Công nghệ thông tin\nĐại học Quốc gia Hà Nội · 2016 – 2020',languages:'Tiếng Việt: Bản ngữ\nTiếng Anh: Giao tiếp công việc',projects:''},
  company:{name:'Axon Technologies',industry:'Công nghệ thông tin',size:'500 – 2.000 nhân viên',location:'Hà Nội',website:'',email:'careers@example.com',description:'Phát triển công cụ dành cho lập trình viên và hạ tầng đám mây. Chúng tôi xây dựng môi trường làm việc cởi mở, nơi mỗi thành viên có cơ hội học hỏi và tạo ra những sản phẩm hữu ích.',benefits:'Bảo hiểm sức khỏe\nThời gian làm việc linh hoạt\nNgân sách học tập hàng năm\nHoạt động gắn kết đội ngũ'},
};
let state=initial;let loaded=false;const listeners=new Set<()=>void>();const key='talentiq-ui-session-v1';
const cvLibraryKey='talentiq-cv-library-v1';
function load(){
  if(loaded||typeof window==='undefined')return;
  loaded=true;
  try {
    const saved=JSON.parse(sessionStorage.getItem(key)||'null');
    if(saved&&Array.isArray(saved.savedJobs)&&Array.isArray(saved.applications)&&saved.profile&&saved.company){
      // Discard obsolete UI booleans; authentication lives only in auth-client memory.
      delete saved.candidateSession;
      delete saved.recruiterSession;
      state={...initial,...saved,profile:{...initial.profile,...saved.profile},company:{...initial.company,...saved.company}};
      if(!Array.isArray(saved.cvs)&&saved.cvName){
        state.cvs=[{id:'legacy-cv',name:saved.cvName,fileName:saved.cvName,size:0,type:/\.docx$/i.test(saved.cvName)?'docx':'pdf',updatedAt:''}];
        state.defaultCvId='legacy-cv';
      }
    }
  } catch {/* Session storage is optional. */}
  try {
    const library=JSON.parse(localStorage.getItem(cvLibraryKey)||'null');
    if(library&&Array.isArray(library.cvs)){
      const cvs:CandidateCV[]=library.cvs.filter((cv:CandidateCV)=>cv&&typeof cv.id==='string'&&typeof cv.name==='string'&&['pdf','docx','profile'].includes(cv.type));
      const active=cvs.find(cv=>cv.id===library.defaultCvId)??cvs[0];
      state={...state,cvs,defaultCvId:active?.id??'',cvName:active?.name??''};
    }
  } catch {/* Keep CV metadata in memory if storage is unavailable. */}
}
function subscribe(listener:()=>void){load();listeners.add(listener);return()=>{listeners.delete(listener);};}
export function useDemo(){return useSyncExternalStore(subscribe,()=>state,()=>initial);}
export function updateDemo(update:Partial<DemoState>|((s:DemoState)=>Partial<DemoState>)){
  load();
  const changes=typeof update==='function'?update(state):update;
  state={...state,...changes};
  try{sessionStorage.setItem(key,JSON.stringify(state));}catch{/* Keep changes in memory. */}
  if('cvs' in changes||'defaultCvId' in changes){
    try{localStorage.setItem(cvLibraryKey,JSON.stringify({cvs:state.cvs,defaultCvId:state.defaultCvId}));}catch{/* Keep changes in this session. */}
  }
  listeners.forEach(l=>l());
}
export function toggleSavedJob(id:string){updateDemo(s=>({savedJobs:s.savedJobs.includes(id)?s.savedJobs.filter(v=>v!==id):[...s.savedJobs,id]}));}
export function setCandidateStage(id:string,status:PipelineStage){updateDemo(s=>({candidateStatuses:{...s.candidateStatuses,[id]:status}}));}
export function applyToJob(jobId:string,cvName?:string,details?:Pick<DemoApplication,'contactName'|'contactEmail'|'coverLetter'>){updateDemo(s=>({applications:s.applications.some(a=>a.jobId===jobId)?s.applications:[{id:`demo-${jobId}`,jobId,cvName,...details,date:new Date().toISOString().slice(0,10),status:'Applied'},...s.applications]}));}


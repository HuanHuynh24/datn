import type {Job} from './data';
const descriptions:Record<string,string>={
 j1:'Tham gia đội ngũ nền tảng, xây dựng API và microservices phục vụ sản phẩm quy mô lớn. Phối hợp cùng các nhóm sản phẩm và frontend để thiết kế hệ thống ổn định, dễ mở rộng.',
 j2:'Thiết kế trải nghiệm và giao diện cho các sản phẩm số. Làm việc cùng quản lý sản phẩm và đội phát triển từ giai đoạn nghiên cứu đến khi đưa sản phẩm đến người dùng.',
 j3:'Phát triển giao diện nhanh, dễ sử dụng và dễ tiếp cận cho nền tảng thương mại điện tử. Phối hợp cùng nhóm thiết kế và backend để cải thiện trải nghiệm khách hàng.',
 j4:'Phân tích dữ liệu tài chính và chuyển các kết quả thành thông tin hữu ích cho hoạt động kinh doanh. Xây dựng báo cáo và trình bày kết quả cho các nhóm liên quan.',
 j5:'Xây dựng, vận hành hạ tầng và quy trình CI/CD để đội ngũ phát triển triển khai sản phẩm ổn định. Cải thiện hiệu năng, khả năng giám sát và độ tin cậy của hệ thống.',
 j6:'Lập kế hoạch và triển khai hoạt động marketing cho sản phẩm giáo dục. Phát triển nội dung, quản lý các kênh truyền thông và đo lường hiệu quả chiến dịch.',
};
const tasks:Record<string,string[]>={
 j1:['Thiết kế API REST và GraphQL có hiệu năng cao.','Phát triển microservices và hệ thống phân tán.','Phối hợp với các nhóm sản phẩm và hướng dẫn lập trình viên mới.'],
 j2:['Nghiên cứu nhu cầu và kiểm thử với người dùng.','Xây dựng wireframe, prototype và giao diện trên Figma.','Phát triển và duy trì hệ thống thiết kế nhất quán.'],
 j3:['Phát triển ứng dụng frontend với React và TypeScript.','Tối ưu hiệu năng, khả năng truy cập và trải nghiệm trên mobile.','Phối hợp với nhóm thiết kế và backend để hoàn thiện tính năng.'],
 j4:['Thu thập, làm sạch và phân tích dữ liệu.','Xây dựng dashboard bằng các công cụ BI.','Trình bày kết quả và đề xuất cải thiện dựa trên dữ liệu.'],
 j5:['Vận hành Kubernetes và hạ tầng đám mây.','Xây dựng và cải thiện quy trình CI/CD.','Giám sát, xử lý sự cố và triển khai các biện pháp bảo mật.'],
 j6:['Xây dựng chiến dịch digital marketing và kế hoạch nội dung.','Quản lý kênh truyền thông và phối hợp với đội thiết kế.','Đo lường kết quả và tối ưu hiệu quả chiến dịch.'],
};
export function jobCopy(job:Job){
 if(!descriptions[job.id])return job;
 const years:Record<string,string>={j1:'Từ 5 năm',j2:'Từ 3 năm',j3:'Từ 2 năm',j4:'1 – 2 năm',j5:'Từ 4 năm',j6:'Từ 3 năm'};
 return {...job,description:descriptions[job.id],responsibilities:tasks[job.id],requirements:[years[job.id]+' kinh nghiệm ở vị trí tương đương.','Có kinh nghiệm với '+job.skills.slice(0,4).join(', ')+'.','Kỹ năng giao tiếp, làm việc nhóm và giải quyết vấn đề tốt.'],benefits:['Mức lương theo năng lực','Bảo hiểm sức khỏe','Cơ hội học tập và phát triển','Hoạt động gắn kết đội ngũ']};
}

import { useEffect, useRef, type ReactNode } from 'react';
import Icon from './Icon';

export default function Dialog({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?:string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className={`cl-dialog ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <div className="cl-dialog-heading"><h2>{title}</h2><button type="button" aria-label="Đóng hộp thoại" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

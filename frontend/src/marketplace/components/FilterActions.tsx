import './filter-actions.css';

export default function FilterActions({onClear,clearLabel='Xóa',applyDisabled=false}:{onClear:()=>void;clearLabel?:string;applyDisabled?:boolean}) {
  return <div className="ui-form-actions search-filter-actions"><button className="ui-btn" type="button" onClick={onClear}>{clearLabel}</button><button className="ui-btn ui-btn-primary" type="submit" disabled={applyDisabled}>Áp dụng</button></div>;
}

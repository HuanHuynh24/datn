import './filter-actions.css';

export default function FilterActions({onClear,clearLabel='Xóa'}:{onClear:()=>void;clearLabel?:string}) {
  return <div className="ui-form-actions search-filter-actions"><button className="ui-btn" type="button" onClick={onClear}>{clearLabel}</button><button className="ui-btn ui-btn-primary" type="submit">Áp dụng</button></div>;
}

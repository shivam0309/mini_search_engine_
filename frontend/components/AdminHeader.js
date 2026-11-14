import { Dashes } from './Logo';

export default function AdminHeader({ title, description, children }) {
  return (
    <div className="admin-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        <Dashes />
      </div>
      {children}
    </div>
  );
}

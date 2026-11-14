import { InfoIcon } from './Icons';

// Shown when the back-end can't be reached or answers with an error.
export default function ServerError({ message }) {
  return (
    <div className="server-error" role="alert">
      <InfoIcon size={18} style={{ marginTop: 2, flex: 'none' }} />
      <div>
        <strong>The search server didn’t respond.</strong>
        <p>{message}</p>
        <p>Start it from the backend folder with: uvicorn app.main:app --reload</p>
      </div>
    </div>
  );
}

import { useStore } from '../lib/store';

export default function SignIn() {
  const { signIn } = useStore();
  return (
    <div className="app bare">
      <div className="signin">
        <h1 className="h1">What's the move?</h1>
        <button className="btn light block" onClick={() => signIn()}>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

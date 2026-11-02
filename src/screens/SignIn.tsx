import { GoogleButton } from '../components/GoogleButton';

export default function SignIn() {
  return (
    <div className="app bare">
      <div className="signin">
        <h1 className="h1">What's the move?</h1>
        <GoogleButton />
      </div>
    </div>
  );
}

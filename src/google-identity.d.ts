// The small part of Google Identity Services this app uses.
declare namespace google.accounts.id {
  function initialize(config: {
    client_id: string;
    nonce?: string;
    callback: (response: { credential: string }) => void;
  }): void;
  function renderButton(
    parent: HTMLElement,
    options: { theme?: string; shape?: string; size?: string; text?: string; width?: number },
  ): void;
}

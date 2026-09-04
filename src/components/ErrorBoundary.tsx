import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Sistrum client error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[#0b0b0f] p-6 text-white">
          <div className="max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-8 text-center">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-[#ff5500]">Sistrum beta</div>
            <h1 className="mt-3 text-2xl font-black">Something went off beat.</h1>
            <p className="mt-3 text-sm text-neutral-400">Your files were not changed. Reload the page to reconnect.</p>
            <button onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-[#ff5500] px-5 py-3 text-sm font-black">Reload Sistrum</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

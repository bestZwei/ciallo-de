import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ciallo crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const strings = t();
    return (
      <div style={{ padding: 24, color: '#f6f2ff', lineHeight: 1.7 }}>
        <p>{strings.crashed}</p>
        <button
          onClick={() => location.reload()}
          style={{
            background: 'transparent',
            color: '#f6f2ff',
            border: '1px solid rgba(246,242,255,.3)',
            borderRadius: 999,
            padding: '8px 18px',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          {strings.reload}
        </button>
      </div>
    );
  }
}

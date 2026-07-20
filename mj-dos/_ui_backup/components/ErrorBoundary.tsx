import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-icon">⚠️</div>
          <div className="error-boundary-title">حدث خطأ غير متوقع</div>
          <div className="error-boundary-text">تم حظر المحتوى لمنع انهيار النظام. يرجى تحديث الصفحة أو الاتصال بالدعم الفني.</div>
          <button className="error-boundary-btn" onClick={() => this.setState({ hasError: false })}>محاولة إعادة التحميل</button>
        </div>
      );
    }
    return this.props.children;
  }
}

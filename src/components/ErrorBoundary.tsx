import { Component, type ReactNode, type ErrorInfo, type ReactElement } from 'react'
import { Icon } from '@/components/ui'

interface Props {
  children: ReactNode
  fallback?: ReactElement
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In production you'd ship this to an error tracker here.
    // For the prototype we log to console so local dev is debuggable.
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-space-md p-space-lg text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-status-critical-bg text-critical">
          <Icon name="error" size={28} />
        </div>
        <div className="max-w-sm">
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
            Something went wrong in this screen
          </h2>
          <p className="mt-space-sm font-body-sm text-body-sm text-on-surface-variant">
            The app couldn't render this page. Your session and data are safe —
            this only affects the current view.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-space-sm">
          <button
            onClick={() => this.handleReset()}
            className="inline-flex items-center gap-space-xs rounded-xl bg-primary px-space-lg py-2 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary/90"
          >
            <Icon name="refresh" size={16} />
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/app/dashboard'}
            className="inline-flex items-center gap-space-xs rounded-xl border border-slate-300 bg-transparent px-space-lg py-2 text-sm font-semibold text-on-surface transition hover:bg-slate-100"
          >
            Back to dashboard
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && this.state.error && (
          <pre className="max-w-lg rounded-xl bg-slate-900 p-space-md text-left text-xs text-slate-200">
            <span className="font-semibold text-white">Error</span>
            <span className="block mt-1 text-slate-400">{this.state.error.message}</span>
            <span className="block mt-2 text-slate-500">{this.state.error.stack}</span>
          </pre>
        )}
      </div>
    )
  }
}

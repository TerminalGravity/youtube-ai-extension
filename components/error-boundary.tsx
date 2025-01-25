export class ErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error("Extension Error:", error, info)
  }

  render() {
    if (this.state.hasError) {
      return <div className="error-fallback">Safe mode UI</div>
    }
    return this.props.children
  }
} 
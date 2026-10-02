import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service here
    console.error("Uncaught Error in Component Tree:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <h1>Oops! Something went wrong.</h1>
          <p style={styles.message}>
            {this.state.error?.message || "An unexpected error occurred while loading this page."}
          </p>
          <button style={styles.button} onClick={this.handleReload}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#141414',
    color: '#ffffff',
    textAlign: 'center',
    padding: '20px',
  },
  message: {
    color: '#aaaaaa',
    margin: '16px 0 24px 0',
    maxWidth: '500px',
  },
  button: {
    padding: '10px 24px',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#e50914',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default ErrorBoundary;
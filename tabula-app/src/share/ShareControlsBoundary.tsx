import { Component, type ErrorInfo, type ReactNode } from "react";

type ShareControlsBoundaryProps = {
  children: ReactNode;
  onError: () => void;
};

type ShareControlsBoundaryState = {
  failed: boolean;
};

export class ShareControlsBoundary extends Component<
  ShareControlsBoundaryProps,
  ShareControlsBoundaryState
> {
  state: ShareControlsBoundaryState = { failed: false };

  static getDerivedStateFromError(): ShareControlsBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

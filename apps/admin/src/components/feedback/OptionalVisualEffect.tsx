import { Component, type ReactNode } from 'react';

/** Decorative effects must never take down the form if their chunk/render fails. */
export class OptionalVisualEffect extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

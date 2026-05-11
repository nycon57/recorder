/* eslint-env node */
const React = require('react');

const Icon = React.forwardRef(function MockLucideIcon(props, ref) {
  return React.createElement('svg', { ref, 'data-testid': 'lucide-icon', ...props });
});

module.exports = new Proxy(
  { __esModule: true, default: Icon },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      return Icon;
    },
  },
);

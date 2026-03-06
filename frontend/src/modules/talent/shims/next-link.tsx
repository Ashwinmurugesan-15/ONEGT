/**
 * src/shims/next-link.tsx
 *
 * Provides a drop-in replacement for the legacy `Link` component
 * using react-router-dom's `Link`.
 */
import React from 'react';
import { Link as RRLink } from 'react-router-dom';

const Link = React.forwardRef(({ href, children, ...props }: any, ref: any) => {
    const to = (typeof href === 'string' && href.startsWith('/') && !href.startsWith('/talent'))
        ? `/talent${href}`
        : href;

    return (
        <RRLink to={to} {...props} ref={ref}>
            {children}
        </RRLink>
    );
});

Link.displayName = 'NextLinkShim';

export default Link;

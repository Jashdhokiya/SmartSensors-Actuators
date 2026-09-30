import React, { useEffect, useRef } from 'react';
import { useSpring, animated } from '@react-spring/web';

interface Props {
  value: number;
  decimals?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  animate?: boolean;
}

// Lightweight numeric interpolation using CSS counting trick
export const ValueDisplay: React.FC<Props> = ({
  value, decimals = 1, className = '', prefix = '', suffix = '', animate = true,
}) => {
  const prevRef = useRef(value);
  const [spring, api] = useSpring(() => ({ val: value }));

  useEffect(() => {
    if (animate) {
      api.start({ val: value, from: { val: prevRef.current } });
    }
    prevRef.current = value;
  }, [value, animate, api]);

  if (!animate) {
    return (
      <span className={className}>
        {prefix}{value.toFixed(decimals)}{suffix}
      </span>
    );
  }

  return (
    <animated.span className={className}>
      {spring.val.to((v) => `${prefix}${v.toFixed(decimals)}${suffix}`)}
    </animated.span>
  );
};

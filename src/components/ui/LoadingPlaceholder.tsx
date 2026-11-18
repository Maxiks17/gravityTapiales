import React from 'react';
import styles from './LoadingPlaceholder.module.css';
import FadeIn from './FadeIn';

type Props = {
  title?: string;
  lines?: number;
  boxes?: number;
  className?: string;
};

const LoadingPlaceholder: React.FC<Props> = ({ title, lines = 2, boxes = 2, className }) => {
  return (
    <FadeIn className={className}>
      <div className={styles.wrapper}>
        <div className={styles.spinner} aria-hidden="true" />
        <div className={styles.skeleton}>
          {title && <div className={styles.skeletonLine} style={{ width: '60%' }} />}
          {Array.from({ length: lines }).map((_, i) => (
            <div key={`line-${i}`} className={styles.skeletonLine} style={{ width: i === 0 ? '60%' : '40%' }} />
          ))}
          <div className={styles.skeletonRow}>
            {Array.from({ length: boxes }).map((_, i) => (
              <div key={`box-${i}`} className={styles.skeletonBox} />
            ))}
          </div>
        </div>
      </div>
    </FadeIn>
  );
};

export default LoadingPlaceholder;

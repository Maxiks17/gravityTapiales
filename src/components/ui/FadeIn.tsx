import React from 'react';
import styles from './FadeIn.module.css';

type Props = {
  children: React.ReactNode;
  className?: string;
};

const FadeIn: React.FC<Props> = ({ children, className }) => {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className={`${styles.wrapper} ${visible ? styles.visible : ''} ${className ?? ''}`}>
      {children}
    </div>
  );
};

export default FadeIn;
